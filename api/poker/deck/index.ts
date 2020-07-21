import * as yup from 'yup'

import { ulid } from 'ulid'
import { PokerDeckEntity } from '../../../models'
import { NowRequest, NowResponse } from '@vercel/node'
import { createHandler, handleValidationError, createDeck, convertDeckKeys, to } from '../../../helpers'


const get = (_req: NowRequest, res: NowResponse) => {
  res.json({ cards: PokerDeckEntity.putParams() })
}

const pileSchema = yup.object().shape({
  name: yup.string().required().max(25),
  cards: yup.number().max(520),
  decks: yup.number().max(10)
}).test("CardCount", "You may only specify one of cards or deck", values => {
  return Boolean(values.cards && values.decks) === false
})

const schema = yup.object().shape({
  piles: yup.array().of(pileSchema)
    .max(5)
    .test("Unique", "Pile names need to be unique", (values: [{ name: string, cards: number }]) =>
      values ? values.every(({ name }, index) => values.findIndex(v => v.name === name) === index) : true
    )
    .test("DrawnPile", "You cannot create a drawn pile", (values: [{ name: string, cards: number }]) =>
      values ? values.every(({ name }) => values.findIndex(v => v.name === `${name}_drawn`) === -1) : true
    )
})

const post = async (req: NowRequest, res: NowResponse) => {
  const { body } = req

  const [validationError, result] = await to(schema.validate(body, { abortEarly: false, stripUnknown: true }))

  if (validationError) {
    return handleValidationError(res, validationError)
  }

  if (!result.piles) result.piles = [{ name: 'main', cards: 52, decks: undefined }]

  const piles = {}

  result.piles.forEach(({ name, cards, decks }) => {
    const deck = createDeck({ cards, decks })
    piles[name] = deck
    piles[`${name}_drawn`] = []
  })

  const gameId = ulid()

  const [databaseError] = await to(PokerDeckEntity.put({
    id: gameId,
    piles
  }, {
    conditions: {
      attr: 'PK',
      exists: false
    }
  }))

  if (databaseError) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An internal server error occurred try again later'
    })
  }

  Object.keys(piles).forEach(key => {
    piles[key] = convertDeckKeys(piles[key])
  })

  res.json({
    gameId,
    piles
  })
}

const methods = {
  get,
  post
}

export default createHandler(methods)