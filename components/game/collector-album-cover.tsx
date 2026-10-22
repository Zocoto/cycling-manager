import { VintageCyclingArtwork } from "./collector-album-artwork";
import book from "./collector-album-book.module.css";
import { CycloStickersGamesArtwork } from "./cyclo-stickers-games-artwork";
import games from "./cyclo-stickers-games.module.css";

type AlbumCoverProps = {
  season: number;
  count: number;
  total: number;
  resumeLabel?: string;
  ready?: boolean;
  onOpen?: () => void;
  onStart?: () => void;
  decorative?: boolean;
  gamesEdition?: boolean;
};

/** The same printed front is used for the closed book and its opening leaf. */
export function CollectorAlbumCover({ season, count, total, resumeLabel, ready = true, onOpen, onStart, decorative = false, gamesEdition = false }: AlbumCoverProps) {
  return <div className={book.closedBook} data-album-cover="" aria-hidden={decorative || undefined}>
    <div className={book.spine} aria-hidden="true">CYCLO-STICKERS · SAISON {season}</div>
    <div className={`${book.coverFace} ${gamesEdition?games.gamesCover:""}`}>
      {!decorative ? <button type="button" className={book.coverHit} disabled={!ready} onClick={onOpen} aria-label="Ouvrir la couverture de l’album" /> : null}
      <p className={book.publisher}>LA CYCLOGAZETTE · ÉDITIONS DU VÉLO</p>
      <p className={book.coverCollection}>{total} VIGNETTES · UNE SAISON À COLLECTIONNER</p>
      <h2 aria-label="Album de Cyclo-Stickers"><span>Album de</span>Cyclo-<br/>Stickers</h2>
      <div className={book.coverPicture}>{gamesEdition?<CycloStickersGamesArtwork className={`${book.coverArt} ${games.gamesArt}`}/>:<VintageCyclingArtwork className={book.coverArt} />}<div className={book.edition}><span>ÉDITION</span><strong>S{season}</strong></div></div>
      <p className={book.coverPoem}>Les champions passent.<br />Les souvenirs restent.</p>
      <div className={book.owner}><span>EXEMPLAIRE PRIVÉ</span><strong>Abbaye du Lion</strong></div>
      {!decorative ? <div className={book.coverActions}>
        <button type="button" className={book.openButton} disabled={!ready} onClick={onOpen}>{resumeLabel ? "Reprendre mon album" : "Ouvrir mon album"}<span aria-hidden="true">↗</span></button>
        {resumeLabel ? <><p>Marque-page · {resumeLabel}</p><button type="button" className={book.startButton} disabled={!ready} onClick={onStart}>Revenir à la première page</button></> : <p>Ouvre la couverture. Retrouve le peloton.</p>}
      </div> : null}
      <div className={book.coverFoot}><span>SAISON {season}</span><strong>{count} / {total} vignettes</strong><span>CYCLO STRATÈGE</span></div>
    </div>
  </div>;
}
