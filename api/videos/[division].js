const { videoData } = require('../../data/videos');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { division } = req.query;
  const key = (division || '').toLowerCase().replace(/\s/g, '');
  const data = videoData[key] || [];
  res.status(200).json(data);
};
