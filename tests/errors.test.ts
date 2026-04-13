import { describe, it, expect } from 'vitest';
import { HelixError, HelixBuildError, HelixDeployError, HelixAPIError, HelixConfigError, formatError } from '../src/errors/index.js';

describe('Error Types', () => {
  it('HelixError has code and suggestion', () => {
    const err = new HelixError('test', 'TEST_ERR', 'try this');
    expect(err.code).toBe('TEST_ERR');
    expect(err.suggestion).toBe('try this');
    expect(err.message).toBe('test');
  });

  it('HelixBuildError has BUILD_ERROR code', () => {
    const err = new HelixBuildError('build failed');
    expect(err.code).toBe('BUILD_ERROR');
    expect(err.name).toBe('HelixBuildError');
  });

  it('HelixDeployError has DEPLOY_ERROR code', () => {
    const err = new HelixDeployError('deploy failed', 'check logs');
    expect(err.code).toBe('DEPLOY_ERROR');
    expect(err.suggestion).toBe('check logs');
  });

  it('HelixAPIError includes statusCode', () => {
    const err = new HelixAPIError('unauthorized', 401, 'check API key');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('API_ERROR');
  });

  it('HelixConfigError has CONFIG_ERROR code', () => {
    const err = new HelixConfigError('missing config');
    expect(err.code).toBe('CONFIG_ERROR');
  });
});

describe('formatError', () => {
  it('formats HelixError with suggestion', () => {
    const err = new HelixDeployError('failed', 'try again');
    const output = formatError(err);
    expect(output).toContain('DEPLOY_ERROR');
    expect(output).toContain('failed');
    expect(output).toContain('try again');
  });

  it('formats plain Error', () => {
    const output = formatError(new Error('something broke'));
    expect(output).toContain('something broke');
  });

  it('formats string errors', () => {
    const output = formatError('raw error');
    expect(output).toContain('raw error');
  });
});
