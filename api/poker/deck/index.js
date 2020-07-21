module.exports = (req, res) => {
  res.writeHead(301, {
    'Location': req.url.replace('/deck', '/')
  })
  res.end()
}