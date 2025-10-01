const jwt = require("jsonwebtoken");
const Session = require("../Models/SessionModel.js");

const verifyToken = async (req, res, next) => {
    try {
        let token = req.headers.authorization;
        if (!token || !token.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Please Provide token or provided token is not valid..." })
        }

        token = token.substring(token.indexOf(" ") + 1);
        console.log(token);

        if (!token) {
            return res.status(401).json({ message: "Token not provided after Bearer..." })
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        console.log(decoded);

        const user = await Session.findOne({ userId: decoded.userId, token: token })

        if (!user) {
            return res.status(401).json({ message: "User already logged out with this token..." })
        }

        req.userId = decoded.userId;

        next();
    }
    catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token Expired..." })
        }
        return res.status(401).json({ message: "Invalid token..." })
    }
}

module.exports = verifyToken