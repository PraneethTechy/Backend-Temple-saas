export class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    if (data !== undefined && data !== null) {
      this.data = data;
    }
  }

  /**
   * Helper that supports both:
   * 1. ApiResponse.success(res, data, message, statusCode)
   * 2. ApiResponse.success(data, message, statusCode)
   */
  static success(...args) {
    if (args[0] && typeof args[0].status === 'function') {
      const [res, data, message = 'Success', statusCode = 200] = args;
      return res.status(statusCode).json(new ApiResponse(statusCode, data, message));
    }
    const [data, message = 'Success', statusCode = 200] = args;
    return new ApiResponse(statusCode, data, message);
  }

  /**
   * Helper that supports both:
   * 1. ApiResponse.created(res, data, message)
   * 2. ApiResponse.created(data, message)
   */
  static created(...args) {
    if (args[0] && typeof args[0].status === 'function') {
      const [res, data, message = 'Created'] = args;
      return res.status(201).json(new ApiResponse(201, data, message));
    }
    const [data, message = 'Created'] = args;
    return new ApiResponse(201, data, message);
  }
}
