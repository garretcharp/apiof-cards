module.exports = (req, res) => {
  res.writeHead(302, {
    'Location': req.url.replace('/deck', '/')
  })
  res.end()
}