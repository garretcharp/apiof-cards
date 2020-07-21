import { PokerDeckEntity } from '../../../models'
import { NowRequest, NowResponse } from '@vercel/node'
import { createHandler, convertDeckKeys, to, isULID } from '../../../helpers'

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

  Object.keys(game.Item.piles).forEach(key => {
    game.Item.piles[key] = {
      remaining: game.Item.piles[key].length
    }
  })

  res.json({ ...game.Item })
}

const del = async (req: NowRequest, res: NowResponse) => {
  const { query: { gameId } } = req

  if (Array.isArray(gameId) || !isULID(gameId)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid gameId recieved'
    })
  }

  const [databaseError] = await to(PokerDeckEntity.delete({
    id: gameId
  }))

  if (databaseError) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An internal server error occurred try again later'
    })
  }

  res.json({ deleted: true, gameId })
}

const methods = {
  get,
  delete: del
}

export default createHandler(methods)