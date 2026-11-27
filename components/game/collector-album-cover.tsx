import type { ReactNode } from "react";
import { VintageCyclingArtwork } from "./collector-album-artwork";
import book from "./collector-album-book.module.css";
import { CycloStickersGamesArtwork } from "./cyclo-stickers-games-artwork";
import games from "./cyclo-stickers-games.module.css";

type AlbumCoverSkin = {
  coverClassName: string; spineClassName: string; headingClassName: string;
  editionClassName: string; actionsClassName: string;
  heading: string; artwork: ReactNode; poem: ReactNode;
};

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
  skin?: AlbumCoverSkin;
  ownerName?: string;
  privatePreview?: boolean;
};

/** The same printed front is used for the closed book and its opening leaf. */
export function CollectorAlbumCover({ season, count, total, resumeLabel, ready = true, onOpen, onStart, decorative = false, gamesEdition = false, skin, ownerName = "Abbaye du Lion", privatePreview = true }: AlbumCoverProps) {
  return <div className={book.closedBook} data-album-cover="" aria-hidden={decorative || undefined}>
    <div className={`${book.spine} ${gamesEdition ? games.gamesSpine : ""} ${skin?.spineClassName ?? ""}`} aria-hidden="true">CYCLO-STICKERS · SAISON {season}</div>
    <div className={`${book.coverFace} ${gamesEdition?games.gamesCover:""} ${skin?.coverClassName ?? ""}`}>
      {!decorative ? <button type="button" className={book.coverHit} disabled={!ready} onClick={onOpen} aria-label="Ouvrir la couverture de l’album" /> : null}
      <p className={book.publisher}>LA CYCLOGAZETTE · ÉDITIONS DU VÉLO</p>
      <p className={book.coverCollection}>{total} VIGNETTES · UNE SAISON À COLLECTIONNER</p>
      <h2 aria-label="Album de Cyclo-Stickers"><span>Album de</span>Cyclo-<br/>Stickers</h2>
      {gamesEdition ? <p className={games.gamesCoverTheme}>HALLOWEEN · JEUX QUADRIENNAUX</p> : null}
      {skin ? <p className={skin.headingClassName}>{skin.heading}</p> : null}
      <div className={book.coverPicture}>{skin ? skin.artwork : gamesEdition?<CycloStickersGamesArtwork className={`${book.coverArt} ${games.gamesArt}`}/>:<VintageCyclingArtwork className={book.coverArt} />}<div className={`${book.edition} ${gamesEdition ? games.gamesEdition : ""} ${skin?.editionClassName ?? ""}`}><span>ÉDITION</span><strong>S{season}</strong></div></div>
      <p className={book.coverPoem}>{skin ? skin.poem : gamesEdition ? <>Une saison de légendes.<br />Une flamme dans la nuit.</> : <>Les champions passent.<br />Les souvenirs restent.</>}</p>
      <div className={book.owner}><span>{privatePreview ? "EXEMPLAIRE PRIVÉ" : "EXEMPLAIRE DE"}</span><strong>{ownerName}</strong></div>
      {!decorative ? <div className={`${book.coverActions} ${gamesEdition ? games.gamesCoverActions : ""} ${skin?.actionsClassName ?? ""}`}>
        <button type="button" className={book.openButton} disabled={!ready} onClick={onOpen}>{resumeLabel ? "Reprendre mon album" : "Ouvrir mon album"}<span aria-hidden="true">↗</span></button>
        {resumeLabel ? <><p>Marque-page · {resumeLabel}</p><button type="button" className={book.startButton} disabled={!ready} onClick={onStart}>Revenir à la première page</button></> : <p>Ouvre la couverture. Retrouve le peloton.</p>}
      </div> : null}
      <div className={book.coverFoot}><span>SAISON {season}</span><strong>{count} / {total} vignettes</strong><span>CYCLO STRATÈGE</span></div>
    </div>
  </div>;
}
