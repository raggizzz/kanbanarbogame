const { app, ensureDataFile } = require("../server");

ensureDataFile();

module.exports = app;
