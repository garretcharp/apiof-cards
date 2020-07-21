import * as yup from 'yup'

import { PokerDeckEntity } from '../../../models'
import { NowRequest, NowResponse } from '@vercel/node'
import { createHandler, convertDeckKeys, to, isULID, shuffle, handleValidationError, config } from '../../../helpers'

const schema = yup.object().shape({
  piles: yup.array(yup.string().min(1).max(35)).default(['main']),
  all: yup.boolean().default(false),
  includeDrawn: yup.boolean().default(false)
})

const get = async (req: NowRequest, res: NowResponse) => {
  let { query: { gameId } } = req

  if (Array.isArray(gameId)) {
    gameId = gameId.find(id => isULID(id))
  }

  if (!isULID(gameId)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid gameId recieved',
      gameId
    })
  }

  if (!req.body) req.body = {}

  const body = {
    piles: req.query.piles || req.body.piles,
    all: req.query.all || req.body.all,
    includeDrawn: req.query.includeDrawn || req.body.includeDrawn
  }

  const [validationError, result] = await to(schema.validate(body, { abortEarly: false, stripUnknown: true }))

  if (validationError) {
    return handleValidationError(res, validationError)
  }

  result.piles = result.piles.map(pile => pile.replace(/ /g, ''))

  if (result.piles.length === 0 && result.all !== true) {
    return res.status(401).json({
      error: 'Bad Request',
      message: 'You must specify piles to shuffle',
      received: result.piles
    })
  }

  const [databaseError, game] = await to(PokerDeckEntity.get({
    id: gameId
  }))

  if (databaseError) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An internal server error occurred try again later'
    })
  }

  if (!game.Item) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'A game with the given id does not exist',
      gameId
    })
  }

  if (result.all === true) {
    result.piles = Object.keys(game.Item.piles)
  }

  const validPiles = Object.keys(game.Item.piles)

  if (result.piles.every(p => validPiles.includes(p)) === false) {
    return res.status(401).json({
      error: 'Bad Request',
      message: 'You must specify piles which exist on the game',
      received: result.piles,
      valid: validPiles
    })
  }

  let modifications = {}

  result.piles.forEach((key: string) => {
    const drawnKey = game.Item.discard ? game.Item.discard : `${key}_drawn`
    const drawn = modifications[drawnKey] || game.Item.piles[drawnKey]
    const pile = game.Item.piles[key]

    if (result.includeDrawn === true) {
      let max: number = game.Item.counts[pile]
      const count = drawn.length + pile

      if (count > max) {
        modifications[key] = shuffle([...pile, ...drawn.slice(0, max - pile.length)])
        modifications[drawnKey] = drawn.slice(max - pile.length)
      } else {
        modifications[key] = shuffle([...pile, ...drawn])
        modifications[drawnKey] = []
      }
    } else {
      modifications[key] = shuffle(pile)
    }
  })

  const [updateError] = await to(PokerDeckEntity.update({
    id: gameId,
    piles: {
      $set: modifications
    },
    TTL: Math.floor((Date.now() + config.dynamo.ttl) / 1000)
  }))

  if (updateError) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An internal server error occurred try again later'
    })
  }

  Object.keys(modifications).forEach(key => {
    modifications[key] = {
      remaining: modifications[key].length,
      shuffled: true
    }
  })

  Object.keys(game.Item.piles).forEach(pile => {
    if (!modifications[pile]) {
      modifications[pile] = {
        remaining: game.Item.piles[pile].length,
        shuffled: false
      }
    }
  })

  res.json({ piles: modifications, gameId })
}

const methods = {
  get,
  post: get
}

export default createHandler(methods)