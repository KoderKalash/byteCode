const express = require("express");
const router = express.Router();
const executeCode = require("../executor/executeCode");

router.post("/", async (req, res) => {
  const { language, code } = req.body;

  if (!language || !code) {
    return res.status(400).json({ error: "Code and language are required." });
  }

  try {
    const output = await executeCode(language, code);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
