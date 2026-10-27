const bcrypt = require("bcryptjs");

const USERS = [
    {
        id: 1,
        username: "admin",
        password: bcrypt.hashSync("admin123", 10)
    }
];

module.exports = USERS;
