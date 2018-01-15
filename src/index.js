// 00000000000000000enterprise0chain44ee610eec057ea5d4aa86b1c2ef680

import io from 'socket.io'
import client from 'socket.io-client'
import { blockchain as blockchainHelpers } from './blockchain'

//All the blockchain helpers
const {
  hash,
  block,
  calculateHash,
  getGenesisBlock,
  createBlockChain,
  isValidNewBlock,
  getLatestBlock,
  addBlock,
  generateNextBlock,
  isValidChain,
  mine
} = blockchainHelpers()

//The local copy of the blockchain
let blockchain = createBlockChain()

//Socket.io Server
const { whoami, server } = (() => {
  const host = process.env.HOST || 'localhost'
  const port = process.env.PORT || 8080
  const whoami = `${host}:${port}`
  console.log('who am i? ' + whoami)
  const server = io(port)
  return {
    whoami,
    server
  }
})()

//initial peers set by environmental variables
let initialPeers = process.env.peers
  ? JSON.parse(process.env.peers)
  : ['localhost:8080', 'localhost:8081', 'localhost:8082']

//The local copy of the database
let data = []

//the array of websocket peers
let sockets = [{ peer: whoami }]

//Setup local websocket server
server.on('connect', socket => {
  console.log('peer connected!')

  //When a client gives a list of peers
  socket.on('peers', incomingPeers => {
    incomingPeers.forEach(
      p =>
        !peers.some(pr => pr.host === p.host) ? peers.push({ ...p }) : void 0
    )
  })

  //When a client wants server peers
  socket.on('getPeers', cb => {
    cb(peers)
  })

  //give client latest block
  socket.on('getLatestBlock', (value, cb) => {
    cb([getLatestBlock({ blockchain })])
  })
})

//Connect to each peer
var connectToPeers = newPeers => {
  newPeers.forEach(peer => {
    if (peer !== whoami && !sockets.some(s => s.peer.indexOf(peer) !== -1)) {
      console.log('connecting to peer: ' + peer)
      const socket = client(`http://${peer}`)
      sockets.push({ peer, socket })
      socket.on('disconnect', reason => {
        console.log('Disconnect Reason', reason)
        sockets = sockets.filter(s => s.peer !== peer)
        socket.close()
      })
      socket.on('receiveBlocks', blocks => {
        handleBlockchainResponse(blocks)
      })
      socket.on('getBlocks', (data, cb) => {
        cb(blockchain)
      })
      socket.emit('getLatestBlock', null, blocks => {
        handleBlockchainResponse(blocks)
      })
    } else {
      console.log('not adding peer:' + peer)
    }
  })
}

//Send latest block to peers
export const broadcastNewBlock = blocks =>
  server.sockets.emit('receiveBlocks', blocks)

//Ask peers for all blocks
export const broadcastGetBlocks = () =>
  sockets.forEach(s =>
    s.socket.emit('getBlocks', null, blocks => {
      handleBlockchainResponse(blocks)
    })
  )

connectToPeers(initialPeers)

//Handle an array of blocks from peers, can be 1 or all
export const handleBlockchainResponse = blocks => {
  var receivedBlocks = blocks.sort((b1, b2) => b1.index - b2.index)
  var newBlock = receivedBlocks[receivedBlocks.length - 1]
  var latestBlockHeld = getLatestBlock({ blockchain })
  if (newBlock.index > latestBlockHeld.index) {
    if (latestBlockHeld.hash === newBlock.prev) {
      addBlock({ blockchain, newBlock })
      broadcastNewBlock([getLatestBlock({ blockchain })])
    } else if (receivedBlocks.length === 1) {
      server.sockets.emit(getBlocks, blocks => {
        if (isValidChain({ blockchainToValidate: blocks })) blockchain = blocks
      })
    } else {
      if (isValidChain({ blockchainToValidate: blocks })) blockchain = blocks
    }
  }
  const latest = getLatestBlock({ blockchain })

  //Parse data from blockchain
  data = parseData(blockchain)

  //For DEMO only
  if (whoami === 'localhost:8080')
    console.log(`DATA:`, JSON.stringify(data, null, '\t'))
  if (whoami === 'localhost:8080')
    console.log(`BLOCKCHAIN:`, JSON.stringify(blockchain, null, '\t'))
}

//Parse data
const parseData = blockchain =>
  blockchain.reduce((memo, { data }) => {
    data.forEach(({ type, key, payload }) => {
      switch (type) {
        case 'NOOP':
          break
        case 'CREPLACE_HASH':
          memo[key] = payload
          break
        case 'UPSERT_HASH':
          memo[key] = memo[key] ? { ...memo[key], ...payload } : payload
          break
        case 'REMOVE_HASH':
          memo[key] = undefined
          delete memo[key]
          break
        case 'PUSH_LIST':
          memo[key] =
            memo[key] && memo[key].constructor === Array
              ? [...memo[key], ...payload]
              : [...[], ...payload]
          break
        case 'REPLACE_LIST':
          memo[key] = payload
          break
        case 'REMOVE_LIST':
          memo[key] = undefined
          delete memo[key]
          break
        default:
      }
    })
    return memo
  }, {})

//Start Mining
const startMining = () => {
  const latestBlock = getLatestBlock({ blockchain })
  const _getLatestBlock = () => getLatestBlock({ blockchain })
  const start = new Date().getTime()
  return mine({
    latestBlock,
    getLatestBlock: _getLatestBlock
  }).then(
    ({ count, newHash }) => {
      const mineTime = new Date().getTime() - start
      console.log(
        `Mined with number ${count} with difficulty ${
          latestBlock.difficulty
        } with hash: ${newHash} in ${mineTime}`
      )
      addBlock({
        blockchain,
        newBlock: generateNextBlock(latestBlock)({
          data: [
            {
              type: 'PUSH_LIST',
              key: 'tokens',
              payload: [
                {
                  reward: { peer: whoami },
                  ts: new Date().getTime(),
                  rewardHash: newHash,
                  minedAtBlock: latestBlock.index + 1,
                  mineTime
                }
              ]
            }
          ],
          pow: count,
          difficulty: latestBlock.difficulty
        })
      })

      broadcastNewBlock([getLatestBlock({ blockchain })])

      return startMining().catch(err => console.error(err))
    },
    err => {
      console.log(err)
      return startMining().catch(err => console.error(err))
    }
  )
}
startMining().catch(err => console.error(err))
