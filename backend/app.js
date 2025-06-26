const express = require("express")
const cors = require("cors")
// const bodyParser = require("body-parser")
const codeRoutes = require("./routes/code")

const app = express()

app.use(cors()) //allow frontend requests

// app.use(bodyParser.json())
app.use(express.json())
 //parse incoming JSON bodies

app.use("/run-code", codeRoutes)

const PORT = 5000;
app.listen(PORT,()=>{
    console.log(`Server running on http://localhost:${PORT}`)
})

