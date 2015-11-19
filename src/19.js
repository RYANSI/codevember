const CodeMirror = require('codemirror/lib/codemirror')
const fs = require('fs')
const insert = require('insert-css')
const acorn = require('acorn')
const walk = require('acorn/dist/walk')
const createLoop = require('canvas-loop')
const colorHash = new (require('color-hash'))()
const astTypes = require('./util/acorn-types')

require('codemirror/mode/xml/xml')
require('codemirror/mode/javascript/javascript')
require('codemirror/mode/css/css')
require('codemirror/mode/htmlmixed/htmlmixed')

// styles
insert(fs.readFileSync(require.resolve('codemirror/lib/codemirror.css'), 'utf8'))
insert(fs.readFileSync(require.resolve('codemirror/theme/material.css'), 'utf8'))

const helloWorld = `
function helloWorld () {
  return 'hello, world'
}

console.log(helloWorld())
`.trim()

// this file's source
const src = fs.readFileSync(__filename, 'utf8')
const textArea = document.querySelector('#text')

function createEditor (callback) {
  const editor = CodeMirror(textArea, {
    lineNumbers: true,
    styleActiveLine: true,
    matchBrackets: true,
    viewportMargin: Infinity,
    theme: 'material',
    value: src,
    mode: 'javascript'
  })

  resize()
  window.addEventListener('resize', resize)

  function resize () {
    editor.setSize(window.innerWidth, window.innerHeight)
  }

  const changed = () => {
    callback(editor.getValue())
  }
  editor.on('change', changed)
  process.nextTick(changed)
  return editor
}

let previousError = null
const editor = createEditor(text => {
  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 6,
      sourceType: 'module',
      allowReserved: true,
      allowReturnOutsideFunction: true,
      allowHashBang: true
    })

    clearPreviousError()
    update(ast, text)
  } catch (err) {
    if (err instanceof SyntaxError && err.loc) {
      clearPreviousError()
      previousError = err.loc.line - 1
      console.error(err)
      editor.addLineClass(previousError, 'background', 'line-error')
    } else {
      throw err
    }
  }
})

const canvas = document.createElement('canvas')
document.body.insertBefore(canvas, textArea)

let nodes = []
const ctx = canvas.getContext('2d')
const app = createLoop(canvas, {
  scale: window.devicePixelRatio
})
app.on('resize', render)

function clearPreviousError () {
  if (typeof previousError !== 'number') return
  editor.removeLineClass(previousError, 'background', 'line-error')
}

function update (ast, text) {
  nodes = allNodes(ast)
  render()
}

function render () {
  const [ width, height ] = app.shape
  ctx.save()
  ctx.scale(app.scale, app.scale)
  ctx.clearRect(0, 0, width, height)

  ctx.fillStyle = 'white'
  ctx.translate(width / 2, height / 2)

  const length = editor.getValue().length
  nodes.forEach((n, i) => {
    const { start, end, type } = n
    const size = (end - start) / length
    const radius = size * 50

    ctx.strokeStyle = colorHash.hex(type)
    const angle = (start / length) * Math.PI * 2
    const parent = Math.min(width, height) / 2
    const x0 = Math.cos(angle) * parent / 2
    const y0 = Math.sin(angle) * parent / 2
    const x1 = Math.cos(angle) * (parent + parent * radius)
    const y1 = Math.sin(angle) * (parent + parent * radius)
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  })

  ctx.restore()
}

function allNodes (ast) {
  const nodes = []
  walkAll(ast, node => nodes.push(node))
  return nodes
}

function walkAll (ast, callback) {
  const visitors = astTypes.reduce((dict, type) => {
    dict[type] = callback
    return dict
  }, {})
  walk.simple(ast, visitors)
}