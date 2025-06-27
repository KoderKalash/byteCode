const supportedLanguages = ["cpp","java","python"]

function validateInput(language,code){
    if(!language || !code) return "Missing language or code"
    if(!supportedLanguages.includes(language)) return "Unsupported Langugage"
    if(typeof code !== "string") return "Code must be a string"
    return null //then valid 
}

module.exports = validateInput