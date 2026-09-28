import type { Response } from 'express';

export class ApiResponse<T = any> {
  public success: boolean;
  public statusCode: number;
  public message: string;
  public data?: T;

  constructor(statusCode: number, data?: T, message: string = 'Success') {
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
  static success(resOrData: any, ...rest: any[]): any {
    if (resOrData && typeof resOrData.status === 'function') {
      const [data, message = 'Success', statusCode = 200] = rest;
      return (resOrData as Response).status(statusCode).json(new ApiResponse(statusCode, data, message));
    }
    const [message = 'Success', statusCode = 200] = rest;
    return new ApiResponse(statusCode, resOrData, message);
  }

  /**
   * Helper that supports both:
   * 1. ApiResponse.created(res, data, message)
   * 2. ApiResponse.created(data, message)
   */
  static created(resOrData: any, ...rest: any[]): any {
    if (resOrData && typeof resOrData.status === 'function') {
      const [data, message = 'Created'] = rest;
      return (resOrData as Response).status(201).json(new ApiResponse(201, data, message));
    }
    const [message = 'Created'] = rest;
    return new ApiResponse(201, resOrData, message);
  }
}

export default ApiResponse;
