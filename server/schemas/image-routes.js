const express = require('express');
const { randomUUID } = require('node:crypto');
const multer = require('multer');
const sharp = require('sharp');
const { authMiddleware } = require('../utils/auth');
const access = require('../utils/access');
const { Profile } = require('../models');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter(req, file, done) {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      const error = new Error('Choose a PNG or JPEG image.');
      error.status = 415;
      return done(error);
    }
    done(null, true);
  },
});

async function requireAccount(req, res, next) {
  try {
    authMiddleware({ req });
    await access.actor(req);
    next();
  } catch {
    res.status(401).json({ error: 'Log in again to continue.' });
  }
}

router.get('/profile/:userId', async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.userId)) return res.sendStatus(404);
    const profile = await Profile.findOne({ profileUser: req.params.userId }).select('+imageData');
    if (!profile?.imageData) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store');
    res.type('jpeg').send(profile.imageData);
  } catch (error) { next(error); }
});

router.get('/profile', requireAccount, async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ profileUser: req.user._id });
    if (!profile) return res.status(404).json({ error: 'Create your profile first.' });
    res.json(profile);
  } catch (error) { next(error); }
});

router.post('/', requireAccount, (req, res, next) => {
  // Check authentication before Multer reads or stores the uploaded data.
  upload.single('image')(req, res, error => {
    if (error) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.status ?? 400;
      return res.status(status).json({
        error: error.code === 'LIMIT_FILE_SIZE' ? 'Choose an image smaller than 2 MB.' : 'Choose one PNG or JPEG image.',
      });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
    let imageData;
    try {
      const decoder = sharp(req.file.buffer, { limitInputPixels: 16_000_000, failOn: 'warning' });
      const metadata = await decoder.metadata();
      if (!['jpeg', 'png'].includes(metadata.format)) {
        return res.status(415).json({ error: 'Choose a valid PNG or JPEG image.' });
      }
      imageData = await decoder
        .rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }).jpeg({ quality: 80 }).toBuffer();
    } catch {
      return res.status(415).json({ error: 'Choose a valid PNG or JPEG image.' });
    }
    const image = '/api/images/profile/' + req.user._id + '?v=' + randomUUID();
    const profile = await Profile.findOneAndUpdate(
      { profileUser: req.user._id }, { $set: { image, imageData } },
      { new: true, runValidators: true },
    );
    if (!profile) return res.status(404).json({ error: 'Create your profile first.' });
    res.json({ message: 'Profile photo updated.', image });
  } catch (error) { next(error); }
});

module.exports = router;
