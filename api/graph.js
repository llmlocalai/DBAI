// Serves the lightweight concept graph (module -> lecture -> concept) built
// from the course material, for any in-page visualization that wants it.
const graph = require('./kb/concept-graph.json');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json(graph);
};
