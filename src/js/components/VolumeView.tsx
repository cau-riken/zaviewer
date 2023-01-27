import { VolumeRenderer } from "@cau-riken/vol-renderer"

import "@cau-riken/vol-renderer/dist/main.css";

const VolumeView = (props: { url: string }) => {
    return (
        <VolumeRenderer
            url={props.url}
            inlineControls={true}
        />
    );
}

export default VolumeView;
