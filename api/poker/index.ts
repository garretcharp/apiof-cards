import * as yup from 'yup'

import { ulid } from 'ulid'
import { PokerDeckEntity } from '../../models'
import { NowRequest, NowResponse } from '@vercel/node'
import { createHandler, handleValidationError, createDeck, PokerCards, shuffle, convertDeckKeys, to } from '../../helpers'


const get = (req: NowRequest, res: NowResponse) => {
  let { query } = req

  let cards = Object.keys(PokerCards)

  if (query.random === 'true') {
    cards = shuffle(cards)
  }

  if (query.count && Number.isNaN(Number(query.count)) === false && Number(query.count) > 0) {
    cards = cards.slice(0, Number(query.count))
  }

  res.json({ cards: convertDeckKeys(cards) })
}

const pileSchema = yup.object().shape({
  name: yup.string().max(25).required().transform(value => value.replace(/ /g, '')),
  cards: yup.number().max(520).default(52),
  decks: yup.number().max(10)
}).test("CardCount", "You may only specify one of cards or deck", values =>
  Boolean(values.cards && values.decks) === false
)

const schema = yup.object().shape({
  piles: yup.array(pileSchema)
    .min(1)
    .max(5)
    .test("Unique", "Pile names need to be unique", (values: [{ name: string, cards: number }]) =>
      values ? values.every((i, index) => values.findIndex(v => v && v.name === i.name) === index) : true
    )
    .test("DrawnPile", "You cannot create a drawn pile", (values: [{ name: string, cards: number }]) =>
      values ? values.every((i) => values.findIndex(v => v && v.name === `${i.name}_drawn`) === -1) : true
    ),
  discard: yup.string()
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

    if (!result.discard)
      piles[`${name}_drawn`] = []
  })

  if (result.discard) {
    piles[result.discard] = []
  }

  const gameId = ulid()

  const item: { id: string, piles: { [key: string]: any }, discard?: string } = {
    id: gameId,
    piles
  }

  if (result.discard) {
    item.discard = result.discard
  }

  const [databaseError] = await to(PokerDeckEntity.put(item, {
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
    piles[key] = {
      created: true,
      remaining: piles[key].length
    }
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