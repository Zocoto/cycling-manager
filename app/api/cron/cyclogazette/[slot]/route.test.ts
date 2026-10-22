import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({authorized:vi.fn(),publish:vi.fn(),recover:vi.fn()}));
vi.mock('@/lib/security/cron-authorization',()=>({isAuthorizedCronRequest:mocks.authorized}));
vi.mock('@/services/cyclogazette',()=>({publishCyclogazetteEdition:mocks.publish,recoverCyclogazetteSeasonFinale:mocks.recover}));
import {GET} from './route';
beforeEach(()=>{vi.clearAllMocks();mocks.authorized.mockReturnValue(true);mocks.publish.mockResolvedValue({status:'published'});mocks.recover.mockResolvedValue({status:'skipped'});});
describe('gazette cron dispatch',()=>{
 it('leaves ordinary publication on its existing path',async()=>{
  expect((await GET(new Request('https://example.test/api/cron/cyclogazette/winter'))).status).toBe(200);
  expect(mocks.publish).toHaveBeenCalledOnce();expect(mocks.recover).not.toHaveBeenCalled();
 });
 it('routes only the finale recovery slot to the guarded late retry',async()=>{
  expect((await GET(new Request('https://example.test/api/cron/cyclogazette/finale-recovery'))).status).toBe(200);
  expect(mocks.recover).toHaveBeenCalledOnce();expect(mocks.publish).not.toHaveBeenCalled();
 });
 it('does not run any publication for unauthorized requests',async()=>{
  mocks.authorized.mockReturnValue(false);
  expect((await GET(new Request('https://example.test/api/cron/cyclogazette/finale-recovery'))).status).toBe(401);
  expect(mocks.recover).not.toHaveBeenCalled();expect(mocks.publish).not.toHaveBeenCalled();
 });
});
