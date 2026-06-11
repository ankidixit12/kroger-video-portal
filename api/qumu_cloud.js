const db = require('../mock-api/db.json');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let videos = db.qumu_cloud || [];

  const { category } = req.query;
  if (category) {
    videos = videos.filter(v => v.category === category);
  }

  res.status(200).json(videos);
};
