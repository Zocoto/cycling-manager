import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {GalaPreparedDownloadLink,prepareGalaDownload} from './season-four-gala-exports';

describe('prepared gala downloads',()=>{
 beforeEach(()=>{vi.useFakeTimers();vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:prepared-gala');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});});
 afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
 const response=()=>new Response(new Uint8Array([80,75]),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="Gala-world-tour-mountain.zip"'}});
 it('keeps the prepared file available for a later explicit click and releases it once on cleanup',async()=>{
  const file=await prepareGalaDownload(response());
  expect(file.filename).toBe('Gala-world-tour-mountain.zip');
  expect(file.url).toBe('blob:prepared-gala');
  expect(file.template).toBe(false);
  vi.advanceTimersByTime(60000);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  file.dispose();file.dispose();
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:prepared-gala');
 });
 it('offers a direct named download link independent of the automatic attempt',()=>{
  const html=renderToStaticMarkup(<GalaPreparedDownloadLink download={{url:'blob:prepared-gala',filename:'Gala-world-tour-mountain.zip'}}/>);
  expect(html).toContain('href="blob:prepared-gala"');
  expect(html).toContain('download="Gala-world-tour-mountain.zip"');
  expect(html).toContain('Télécharger le fichier préparé');
  expect(html).toContain('Gala-world-tour-mountain.zip');
 });
 it('preserves the actionable server failure without creating a download URL',async()=>{
  await expect(prepareGalaDownload(Response.json({error:'Authentification requise.'},{status:401}))).rejects.toThrow('Authentification requise.');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
 });
 it('rejects unsafe or missing download filenames',async()=>{
  for(const disposition of ['', 'attachment; filename="unsafe/path.zip"'])await expect(prepareGalaDownload(new Response('ZIP',{headers:{'Content-Disposition':disposition}}))).rejects.toThrow('Nom du fichier');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
 });
 it('does not claim that an empty response is a usable archive',async()=>{
  await expect(prepareGalaDownload(new Response('',{headers:{'Content-Disposition':'attachment; filename="Gala.zip"'}}))).rejects.toThrow('vide');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
 });
});
