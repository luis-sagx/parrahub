import { GlobalExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockLoggerError: jest.SpyInstance;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockLoggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    mockLoggerError.mockRestore();
  });

  const createMockHost = (overrides: { status?: number; exception?: any; method?: string; url?: string } = {}) => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({
          method: overrides.method || 'GET',
          url: overrides.url || '/api/test',
        }),
      }),
      response,
    };
  };

  it('should return 404 for NotFoundException', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'GET', url: '/test' }) }) } as any);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
      }),
    );
  });

  it('should return 400 for BadRequestException', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

    filter.catch(exception, { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'POST', url: '/api' }) }) } as any);

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('should return 500 for generic errors', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const exception = new Error('Unknown error');

    filter.catch(exception, { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'GET', url: '/api' }) }) } as any);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Error interno del servidor',
      }),
    );
  });

  it('should include timestamp in response', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const exception = new HttpException('Error', HttpStatus.INTERNAL_SERVER_ERROR);

    filter.catch(exception, { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'GET', url: '/api' }) }) } as any);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
      }),
    );
  });

  it('should include path in response', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'GET', url: '/api/users/1' }) }) } as any);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/users/1',
      }),
    );
  });
});