import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

import config from './config.json'

function isUpperCase(ch) {
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase()
}

function hasLegalCharacters(word, opts) {
  for (let i = 0; i < word.length; ++i) {
    var ch = word.charAt(i)
    if (ch === '-')
      return false
    else if (!opts.allowUpperCase && isUpperCase(ch))
      return false
  }
  return true
}

function readWordList(file, opts) {
  return new Promise((resolve, reject) => {
    const wordList = [ ]
    readline.createInterface({ input: fs.createReadStream(file) })
      .on('line', word => {
        if (word.length < opts.minLength || word.length > opts.maxLength)
          return
        if (!hasLegalCharacters(word, opts))
          return
        wordList.push(word)
      })
      .on('close', () => {
        return resolve(wordList)
      })
  })
}

function writeFile(file, contents) {
  return new Promise((resolve, reject) => {
    const dirname = path.dirname(file)
    fs.mkdir(dirname, e => {
      if (e && e.code !== 'EEXIST') return reject(e)

      fs.writeFile(file, contents, e => {
        if (e) return reject(e)

        return resolve()
      })
    })
  })
}

async function readBadWords(inputs, opts) {
  if (!inputs.bad) return [ ]
  return Promise.all(inputs.bad.map(file => readWordList(file, opts)))
}

async function readCommon(inputs, opts) {
  if (!inputs.common) return readWordList(inputs.dictionary, opts)
  return readWordList(inputs.common, opts)
}

async function main() {
  for (const [ lang, { inputs, outputs, opts } ] of Object.entries(config)) {
    const dictionary = await readWordList(inputs.dictionary, opts)

    const badWords = _.chain(await readBadWords(inputs, opts))
      .flatten()
      .sortBy()
      .sortedUniq()
      .value()

    const common = _.chain(await readCommon(inputs, opts))
      .intersection(dictionary)
      .difference(badWords)
      .value()

    const alphabet = _.chain(common)
      .reduce((result, value) => {
        for (let i = 0; i < value.length; ++i) {
          const c = value.charAt(i)
          if (result.indexOf(c) === -1)
            result += c
        }
        return result
      }, '')
      .value()
      .split('')
      .sort()
      .join('')

    await Promise.all([
      writeFile(outputs.alphabet, alphabet),
      writeFile(outputs.common, common.join('\n'))
    ])
  }
}

main()
  .then(() => { console.log('done') })
  .catch(e => { console.log(e.stack) })
