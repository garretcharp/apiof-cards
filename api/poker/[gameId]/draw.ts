import * as yup from 'yup'

import { PokerDeckEntity } from '../../../models'
import { NowRequest, NowResponse } from '@vercel/node'
import { createHandler, convertDeckKeys, to, isULID, handleValidationError, config, shuffle } from '../../../helpers'

const schema = yup.object().shape({
  pile: yup.string().min(1).max(35).default('main').transform(value => value.replace(/ /g, '')),
  count: yup.number().required().min(1).max(100).default(1),
  force: yup.boolean().default(false)
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
    pile: req.query.pile || req.body.pile,
    count: req.query.count || req.body.count,
    force: req.query.force || req.body.force
  }

  const [validationError, result] = await to(schema.validate(body, { abortEarly: false, stripUnknown: true }))

  if (validationError) {
    return handleValidationError(res, validationError)
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

  const discardTo = game.Item.discard ? game.Item.discard : `${result.pile}_drawn`

  let pile: string[] = game.Item.piles[result.pile]
  let drawnPile: string[] = game.Item.piles[discardTo]

  if (!pile && Object.keys(game.Item.piles).length !== 1) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A pile with the given name does not exist',
      pile: result.pile,
      valid: Object.keys(game.Item.piles)
    })
  } else {
    pile = game.Item.piles[Object.keys(game.Item.piles)[0]]
  }

  if (result.force === true && pile.length < result.count) {
    pile = shuffle([...pile, ...drawnPile])
    drawnPile = []
  }

  const drawn = pile.slice(0, result.count)
  const remaining = pile.slice(result.count)
  const allDrawn = [...drawnPile, ...drawn]

  const [updateError] = await to(PokerDeckEntity.update({
    id: gameId,
    piles: {
      $set: {
        [result.pile]: remaining,
        [discardTo]: allDrawn
      }
    },
    TTL: Math.floor((Date.now() + config.dynamo.ttl) / 1000)
  }))

  if (updateError) {
    console.error(updateError)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An internal server error occurred try again later'
    })
  }

  res.json({ drawn: { cards: convertDeckKeys(drawn), count: drawn.length }, remaining: remaining.length, gameId })
}

const methods = {
  get,
  post: get
}

export default createHandler(methods)