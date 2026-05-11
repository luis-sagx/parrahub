import { ValidationPipe } from '@nestjs/common';
import { GlobalValidationPipe } from './validation.pipe';

describe('GlobalValidationPipe', () => {
  it('should be an instance of ValidationPipe', () => {
    expect(GlobalValidationPipe).toBeInstanceOf(ValidationPipe);
  });
});
