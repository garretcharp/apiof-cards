module.exports = (req, res) => {
  res.writeHead(302, {
    'Location': 'https://app.swaggerhub.com/apis-docs/gch/apiof-cards/1.0.0#'
  })
  res.end()
}