export class ApiError extends Error {
    constructor(
        statusCode,
        message = "Something Went Wrong",
        errors = [],
        stack = "",
    ) {
        super(message)
        this.data = null
        this.statusCode = statusCode
        this.message = message
        this.success = false
        this.errors = errors

            (stack) ? this.stack = stack : Error.captureStackTrace(this, this.constructor)
    }

}