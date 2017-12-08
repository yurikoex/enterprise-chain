import { createHash } from 'crypto'

//create a 32 character hash of any string
export const hash = str =>
	createHash('sha256')
		.update(str)
		.digest('hex')

//create hash of block data
export const calculateHash = ({ hash }) => ({
	index,
	prev,
	ts,
	data,
	nonce,
	difficulty
}) =>
	hash(
		index.toString() +
			prev.toString() +
			ts.toString() +
			(typeof data === 'object' ? JSON.stringify(data) : data) +
			nonce.toString() +
			difficulty.toString()
	)

//ensure the format of block
export const block = ({ index, prev, ts, data, nonce, hash, difficulty }) => ({
	index,
	prev,
	ts,
	data,
	nonce,
	difficulty,
	hash
})

//create a genesis block
export const getGenesisBlock = ({ block, calculateHash, hash }) => (
	seed = {
		ts: 1234567890, //new Date().getTime(),
		data: [{ message: 'In the beginning...' }]
	}
) =>
	block({
		index: 0,
		prev: '0',
		ts: seed.ts,
		data: seed.data,
		nonce: 0,
		difficulty: 5,
		hash: calculateHash({
			index: 0,
			prev: '0',
			ts: seed.ts,
			data: seed.data,
			nonce: 0,
			difficulty: 5
		})
	})

export const createBlockChain = ({ getGenesisBlock }) => () => [
	getGenesisBlock()
]

export const addBlock = ({ isValidNewBlock, getLatestBlock }) => ({
	blockchain,
	newBlock
}) => {
	if (
		isValidNewBlock({ newBlock, previousBlock: getLatestBlock({ blockchain }) })
	) {
		blockchain.push(newBlock)
	}
}

export const getLatestBlock = ({ blockchain }) =>
	blockchain[blockchain.length - 1]

export const generateNextBlock = ({ calculateHash, block }) => ({
	index: prevIndex,
	hash: prev
}) => ({ data, nonce, difficulty }) => {
	var index = prevIndex + 1
	var ts = new Date().getTime()
	var hash = calculateHash({ index, prev, ts, data, nonce, difficulty })
	return block({
		index,
		prev,
		ts,
		data,
		hash,
		nonce,
		difficulty
	})
}

export const isValidNewBlock = ({ calculateHash }) => ({
	newBlock,
	previousBlock
}) => {
	if (previousBlock.index + 1 !== newBlock.index) {
		console.log('invalid index')
		return false
	} else if (previousBlock.hash !== newBlock.prev) {
		console.log('invalid previoushash')
		return false
	} else if (calculateHash(newBlock) !== newBlock.hash) {
		console.log(typeof newBlock.hash + ' ' + typeof calculateHash(newBlock))
		console.log(
			'invalid hash: ' + calculateHash(newBlock) + ' ' + newBlock.hash
		)
		return false
	}
	return true
}

export const isValidChain = ({ getGenesisBlock, isValidNewBlock }) => ({
	blockchainToValidate
}) => {
	if (
		JSON.stringify(blockchainToValidate[0]) !==
		JSON.stringify(getGenesisBlock())
	) {
		return false
	}
	var tempBlocks = [blockchainToValidate[0]]
	for (var i = 1; i < blockchainToValidate.length; i++) {
		if (
			isValidNewBlock({
				newBlock: blockchainToValidate[i],
				previousBlock: tempBlocks[i - 1]
			})
		) {
			tempBlocks.push(blockchainToValidate[i])
		} else {
			return false
		}
	}
	return true
}

export const mine = ({ hash }) => ({ latestBlock, getLatestBlock }) =>
	new Promise((resolve, reject) => {
		let count = Math.floor(Math.random() * 1000000)
		const increment = () =>
			setTimeout(() => {
				const newHash = hash(`${latestBlock.hash}${count}`)
				if (getLatestBlock().hash !== latestBlock.hash) reject('cancelled')
				else if (
					newHash.startsWith(new Array(latestBlock.difficulty).join('0'))
				)
					resolve({ count, newHash })
				else {
					count++
					increment()
				}
			}, 0)
		increment()
	})

export const blockchain = () => {
	const _calculateHash = calculateHash({ hash })
	const _getGenesisBlock = getGenesisBlock({
		block,
		calculateHash: _calculateHash,
		hash
	})
	const _createBlockChain = createBlockChain({
		getGenesisBlock: _getGenesisBlock
	})
	const _isValidNewBlock = isValidNewBlock({ calculateHash: _calculateHash })
	const _addBlock = addBlock({
		isValidNewBlock: _isValidNewBlock,
		getLatestBlock
	})
	const _generateNextBlock = generateNextBlock({
		calculateHash: _calculateHash,
		block
	})
	const _isValidChain = isValidChain({
		getGenesisBlock: _getGenesisBlock,
		isValidNewBlock: _isValidNewBlock
	})
	const _mine = mine({ hash })
	return {
		hash,
		block,
		calculateHash: _calculateHash,
		getGenesisBlock: _getGenesisBlock,
		createBlockChain: _createBlockChain,
		isValidNewBlock: _isValidNewBlock,
		getLatestBlock: obj => getLatestBlock(obj),
		addBlock: _addBlock,
		generateNextBlock: _generateNextBlock,
		isValidChain: _isValidChain,
		mine: _mine
	}
}
