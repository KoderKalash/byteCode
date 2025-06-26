const express = require("express")
const router = express.Router()
const validateInput = require("../utils/validateInput")
const executeCode = require("../executor/execute")

router.post("/" , async (req,res)=> {
    console.log("Request body: ", req.body)
    const {language,code} = req.body

    const error = validateInput(language,code)
    if(error) return res.status(400).json({error})

        try{
            const output = await executeCode(language,code)
            res.json({output}) //sending result to frontend
        }catch(err) {
            res.status(500).json({error:err.message || "Execution Failed"})
        }
})

module.exports = router