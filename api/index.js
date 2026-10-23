Before:
module.exports = async (req, res) => {
  /* your code */
};

After:
const lock = require("./hdd-lock");

module.exports = lock(async (req, res) => {
  /* your code, unchanged */
});

(If your file uses "export default", write: import lock from "./hdd-lock.js"; export default lock(async (req, res) => { ... });)
