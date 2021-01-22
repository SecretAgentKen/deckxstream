module.exports = {
    "env": {
        "commonjs": true,
        "es2021": true,
        "node": true,
        "mocha": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:mocha/recommended"
    ],
    "parserOptions": {
        "ecmaVersion": 12
    },
    "rules": {
        "indent": ["error","tab"],
        "semi": [2,"always"]
    },
    "plugins":[
        "mocha"
    ]
};
