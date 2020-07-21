import { NowRequest, NowResponse } from '@vercel/node'

export const handleValidationError = (res: NowResponse, error: any) => {
  res.status(400).json({
    error: error.name,
    message: error.message,
    errors: error.errors
  })
}

export const createHandler = (methods: { [key: string]: Function }) => {
  const supported = Object.keys(methods).map(method => method.toUpperCase())

  return (req: NowRequest, res: NowResponse) => {
    const method = methods[req.method.toLowerCase()]

    if (method) {
      method(req, res)
    } else {
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `Method: ${req.method} is not supported.`,
        supported
      })
    }
  }
}

export const shuffle = (input: any[]) => {
  const array = [...input]
  let currentIndex = array.length

  while (0 !== currentIndex) {
    let randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1

    let temp = array[currentIndex]
    array[currentIndex] = array[randomIndex]
    array[randomIndex] = temp
  }

  return array
}

const PokerValues = [
  { value: 'ACE', code: 'A' },
  { value: 'TWO', code: '2' },
  { value: 'THREE', code: '3' },
  { value: 'FOUR', code: '4' },
  { value: 'FIVE', code: '5' },
  { value: 'SIX', code: '6' },
  { value: 'SEVEN', code: '7' },
  { value: 'EIGHT', code: '8' },
  { value: 'NINE', code: '9' },
  { value: 'TEN', code: '10' },
  { value: 'JACK', code: 'J' },
  { value: 'QUEEN', code: 'Q' },
  { value: 'KING', code: 'K' }
]

const PokerSuits = [
  { suit: 'CLUBS', code: 'C' },
  { suit: 'SPADES', code: 'S' },
  { suit: 'HEARTS', code: 'H' },
  { suit: 'DIAMONDS', code: 'D' }
]

const PokerCards = {}

for (let index = 0; index < PokerValues.length; index++) {
  const { value, code: valueCode } = PokerValues[index];

  for (let index = 0; index < PokerSuits.length; index++) {
    const { suit, code: suitCode } = PokerSuits[index];

    const code = `${valueCode}${suitCode}`

    PokerCards[code] = {
      image: `https://apiof-cards.vercel.app/static/poker/fronts/${code}.png`,
      value,
      suit,
      code
    }
  }
}



export { PokerValues, PokerSuits, PokerCards }

interface ICreateDeckOptions {
  decks?: number
  cards?: number
}

export const createDeck = ({ decks, cards }: ICreateDeckOptions = {}, deckType = PokerCards) => {
  if (decks && cards) {
    throw new Error("Invalid Options. Cannot specify both decks and cards.")
  } else if (decks) {
    cards = Math.floor(decks * 52)
  } else {
    cards = Math.floor(cards || 52)
  }

  const deckCount = Math.ceil(cards / 52)

  const deck = []

  // add cards as decks
  for (let index = 0; index < deckCount; index++) {
    let cardsToAdd = cards - deck.length >= 52 ? 52 : cards - deck.length

    const shuffledCards = shuffle(Object.keys(deckType))

    for (let i = 0; i < cardsToAdd; i++) {
      deck.push(shuffledCards[i])
    }
  }

  return deck
}

export const convertDeckKeys = (keys: string[], deckType = PokerCards) => keys.map(key => deckType[key])


export const config = {
  aws: {
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
    region: process.env.AWS_LOCATION
  },
  dynamo: {
    endpoint: process.env.AWS_DYNAMO_ENDPOINT,
    tableName: process.env.AWS_DYNAMO_TABLE,
    ttl: 1000 * 60 * 60 * 24 * 7
  }
}

export const to = prom => prom.then(r => [null, r]).catch(e => [e, null])

// ULID SPEC VALUES DO NOT CHANGE
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford's Base32
const ENCODING_LEN = ENCODING.length
const TIME_MAX = Math.pow(2, 48) - 1
const TIME_LEN = 10
const RANDOM_LEN = 16

export function isULID(id: string) {
  if (
    typeof id !== 'string' ||
    id.length !== TIME_LEN + RANDOM_LEN ||
    !id.split('').every(char => ENCODING.indexOf(char) !== -1)
  )
    return false

  const time_id = id.substr(0, TIME_LEN)

  return isValidTimeULID(time_id)
}

function isValidTimeULID(time_id) {
  const parts = time_id.split('').reverse()

  const time_value = parts.reduce(
    (carry, char, index) =>
      (carry += ENCODING.indexOf(char) * Math.pow(ENCODING_LEN, index)),
    0
  )

  return time_value < TIME_MAX && time_value > 0
}