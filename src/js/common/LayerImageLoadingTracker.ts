interface TiledImage {
}

export enum LoadingStatus {
    pending = 'pending',
    starting = 'starting',
    added = 'added',
    loading = 'loading',
    loaded = 'loaded',
    error = 'error',
}

export interface ImageInfos {
    readonly key: string,
    readonly ordnum: number,
    status: LoadingStatus,
    visible: boolean,
    readonly bootstrap?: boolean,
    tiledImage: TiledImage | undefined,
    loadCount: number,
};


export class LayerImageLoadingTracker {
    private readonly BootstrapOrdnum = 0;

    private nextImgOrdNum: number = this.BootstrapOrdnum;
    private imageInfos: ImageInfos[] = [];
    private target = new EventTarget();

    enqueueImage(key: string, bootstrap?: boolean) {

        const infos = Object.assign(
            {
                key: key,
                ordnum: this.nextImgOrdNum++,
                status: LoadingStatus.pending,
                visible: true,
                tiledImage: undefined,
                loadCount: 0,
            },
            bootstrap ? { bootstrap } : {}
        );
        this.imageInfos.push(infos);

        this.dispatchChangeEvent(infos);
        return infos.ordnum;

    }

    setStatus(ordnum: number, status: LoadingStatus, tiledImage?: TiledImage) {
        const infos = this.imageInfos.find(infos => infos.ordnum == ordnum);
        if (infos) {
            if (infos.status != LoadingStatus.loaded) {
                infos.status = status;
            }
            if (tiledImage) {
                infos.tiledImage = tiledImage;
            }
            this.dispatchChangeEvent(infos);
        }
    }

    setLoading(ordnum: number) {
        const infos = this.getInfosByOrdnum(ordnum)
        if (infos) {
            infos.status = LoadingStatus.loading;
            this.dispatchChangeEvent(infos);
        } else {
            console.error('infos is GONE!', ordnum);
        }
    }

    setLoaded(ordnum: number) {
        const infos = this.getInfosByOrdnum(ordnum)
        if (infos) {
            //loadCount>1 when tileimage has been reloaded (triggered by filtering, viewport change...)
            infos.loadCount++;
            infos.status = LoadingStatus.loaded;
            this.dispatchChangeEvent(infos);
        } else {
            console.error('infos is GONE!', ordnum);
        }
    }

    setVisible(ordnum: number, visible: boolean) {
        const infos = this.imageInfos.find(infos => infos.ordnum == ordnum);
        if (infos) {
            infos.visible = visible;
            this.dispatchChangeEvent(infos);
        }
    }

    nbEnqueued() {
        return this.imageInfos.length;
    }

    getBotstrapInfos() {
        return (this.imageInfos.length >= 1 && this.imageInfos[0].bootstrap) ? this.imageInfos[0] : undefined;
    }

    getUnloadedInfos() {
        return this.imageInfos.filter(infos => infos.visible && (infos.status != LoadingStatus.loaded));
    }

    getInfosByOrdnum(ordnum: number) {
        return this.imageInfos.find(infos => infos.ordnum == ordnum);
    }

    getInfosByTiledImage(tiledImage: TiledImage) {
        return this.imageInfos.find(infos => infos.tiledImage == tiledImage);
    }

    getMostRecentInLayer(key: string) {
        return this.imageInfos.findLast((infos: ImageInfos) => infos.key == key);
    }

    isAllLoaded() {
        //true if all enqueued visible images are loaded
        return this.imageInfos.findIndex(infos => infos.visible && (infos.status != LoadingStatus.loaded)) == -1;
    }

    collectRemovableInfos(layerKey: string, beforeOrdnum: number, keepSubstitute?: boolean) {
        //candidate images for removal, i.e. the one corresponding to previous slices of the specified layer
        const cancelables = this.imageInfos.filter(({ key, ordnum }) => key == layerKey && ordnum < beforeOrdnum);
        //actually removed image
        const canceled: ImageInfos[] = [];

        // if triggering image is not yet loaded, we prefer to kept last loaded image to prevent transition to black
        let substitute: ImageInfos;
        if (keepSubstitute) {
            const triggering = this.imageInfos.findLast((infos: ImageInfos) => infos.key == layerKey && infos.ordnum == beforeOrdnum && infos.status != LoadingStatus.loaded);
            if (triggering && triggering.status != LoadingStatus.loaded) {
                substitute = this.imageInfos.findLast(
                    (infos: ImageInfos) => (infos.key == layerKey)
                        && (infos.ordnum < beforeOrdnum)
                        && (infos.status == LoadingStatus.loaded)
                );
            }
        }

        cancelables.forEach((ti) => {
            //if necessary, keep already loaded image of this layer as substitute
            if (substitute && ti == substitute) {
                return;
            }
            canceled.push(ti);
        });

        return canceled;
    }

    removeInfos(canceled: ImageInfos[]) {
        this.imageInfos = this.imageInfos.filter(infos => !canceled.includes(infos));
        this.dispatchChangeEvent();
    }

    // ------------------------------------------------------------------------- //
    private readonly ChangeEventType = 'images-changed';

    addEventListener(listener: ((e: Event) => boolean) | null) {
        this.target.addEventListener(this.ChangeEventType, listener);
    }

    removeEventListener(listener: ((e: Event) => boolean) | null) {
        this.target.removeEventListener(this.ChangeEventType, listener);
    }

    private dispatchChangeEvent(infos?: ImageInfos): boolean {
        const allLoaded = this.isAllLoaded();
        return this.target.dispatchEvent(
            Object.assign(
                new Event(this.ChangeEventType),
                { allLoaded: allLoaded },
                infos ? { trigger: infos } : {}
            ));
    }

    // ------------------------------------------------------------------------- //

    static create() {
        return new LayerImageLoadingTracker();
    }


}

export default LayerImageLoadingTracker;