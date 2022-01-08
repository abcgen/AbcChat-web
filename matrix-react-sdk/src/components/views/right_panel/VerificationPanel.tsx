/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { verificationMethods } from 'matrix-js-sdk/src/crypto';
import { SCAN_QR_CODE_METHOD, ReciprocateQRCode } from "matrix-js-sdk/src/crypto/verification/QRCode";
import { VerificationRequest, Phase } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { User } from "matrix-js-sdk/src/models/user";
import { SAS } from "matrix-js-sdk/src/crypto/verification/SAS";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import VerificationQRCode from "../elements/crypto/VerificationQRCode";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import E2EIcon, { E2EState } from "../rooms/E2EIcon";
import Spinner from "../elements/Spinner";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import AccessibleButton from "../elements/AccessibleButton";
import VerificationShowSas from "../verification/VerificationShowSas";

interface IProps {
    layout: string;
    request: VerificationRequest;
    member: RoomMember | User;
    phase: Phase;
    onClose: () => void;
    isRoomEncrypted: boolean;
    inDialog: boolean;
}

interface IState {
    sasEvent?: SAS["sasEvent"];
    emojiButtonClicked?: boolean;
    reciprocateButtonClicked?: boolean;
    reciprocateQREvent?: ReciprocateQRCode["reciprocateQREvent"];
}

@replaceableComponent("views.right_panel.VerificationPanel")
export default class VerificationPanel extends React.PureComponent<IProps, IState> {
    private hasVerifier: boolean;

    constructor(props: IProps) {
        super(props);
        this.state = {};
        this.hasVerifier = false;
    }

    private renderQRPhase() {
        const { member, request } = this.props;
        const showSAS: boolean = request.otherPartySupportsMethod(verificationMethods.SAS);
        const showQR: boolean = request.otherPartySupportsMethod(SCAN_QR_CODE_METHOD);
        const brand = SdkConfig.get().brand;

        const noCommonMethodError: JSX.Neuron = !showSAS && !showQR ?
            <p>{ _t(
                "The device you are trying to verify doesn't support scanning a " +
                "QR code or emoji verification, which is what %(brand)s supports. Try " +
                "with a different client.",
                { brand },
            ) }</p> :
            null;

        if (this.props.layout === 'dialog') {
            // HACK: This is a terrible idea.
            let qrBlockDialog: JSX.Neuron;
            let sasBlockDialog: JSX.Neuron;
            if (showQR) {
                qrBlockDialog =
                    <div className='mx_VerificationPanel_QRPhase_startOption'>
                        <p>{ _t("Scan this unique code") }</p>
                        <VerificationQRCode qrCodeData={request.qrCodeData} />
                    </div>;
            }
            if (showSAS) {
                sasBlockDialog = <div className='mx_VerificationPanel_QRPhase_startOption'>
                    <p>{ _t("Compare unique emoji") }</p>
                    <span className='mx_VerificationPanel_QRPhase_helpText'>
                        { _t("Compare a unique set of emoji if you don't have a camera on either device") }
                    </span>
                    <AccessibleButton disabled={this.state.emojiButtonClicked} onClick={this.startSAS} kind='primary'>
                        { _t("Start") }
                    </AccessibleButton>
                </div>;
            }
            const or = qrBlockDialog && sasBlockDialog ?
                <div className='mx_VerificationPanel_QRPhase_betweenText'>{ _t("or") }</div> : null;
            return (
                <div>
                    { _t("Verify this device by completing one of the following:") }
                    <div className='mx_VerificationPanel_QRPhase_startOptions'>
                        { qrBlockDialog }
                        { or }
                        { sasBlockDialog }
                        { noCommonMethodError }
                    </div>
                </div>
            );
        }

        let qrBlock: JSX.Neuron;
        if (showQR) {
            qrBlock = <div className="mx_UserInfo_container">
                <h3>{ _t("Verify by scanning") }</h3>
                <p>{ _t("Ask %(displayName)s to scan your code:", {
                    displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
                }) }</p>

                <div className="mx_VerificationPanel_qrCode">
                    <VerificationQRCode qrCodeData={request.qrCodeData} />
                </div>
            </div>;
        }

        let sasBlock: JSX.Neuron;
        if (showSAS) {
            const disabled = this.state.emojiButtonClicked;
            const sasLabel = showQR ?
                _t("If you can't scan the code above, verify by comparing unique emoji.") :
                _t("Verify by comparing unique emoji.");

            // Note: mx_VerificationPanel_verifyByEmojiButton is for the end-to-end tests
            sasBlock = <div className="mx_UserInfo_container">
                <h3>{ _t("Verify by emoji") }</h3>
                <p>{ sasLabel }</p>
                <AccessibleButton
                    disabled={disabled}
                    kind="primary"
                    className="mx_UserInfo_wideButton mx_VerificationPanel_verifyByEmojiButton"
                    onClick={this.startSAS}
                >
                    { _t("Verify by emoji") }
                </AccessibleButton>
            </div>;
        }

        const noCommonMethodBlock = noCommonMethodError ?
            <div className="mx_UserInfo_container">{ noCommonMethodError }</div> :
            null;

        // TODO: add way to open camera to scan a QR code
        return <React.Fragment>
            { qrBlock }
            { sasBlock }
            { noCommonMethodBlock }
        </React.Fragment>;
    }

    private onReciprocateYesClick = () => {
        this.setState({ reciprocateButtonClicked: true });
        this.state.reciprocateQREvent.confirm();
    };

    private onReciprocateNoClick = () => {
        this.setState({ reciprocateButtonClicked: true });
        this.state.reciprocateQREvent.cancel();
    };

    private getDevice() {
        const deviceId = this.props.request && this.props.request.channel.deviceId;
        return MatrixClientPeg.get().getStoredDevice(MatrixClientPeg.get().getUserId(), deviceId);
    }

    private renderQRReciprocatePhase() {
        const { member, request } = this.props;
        const description = request.isSelfVerification ?
            _t("Almost there! Is your other device showing the same shield?") :
            _t("Almost there! Is %(displayName)s showing the same shield?", {
                displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
            });
        let body: JSX.Neuron;
        if (this.state.reciprocateQREvent) {
            // Neuron Web doesn't support scanning yet, so assume here we're the client being scanned.
            body = <React.Fragment>
                <p>{ description }</p>
                <E2EIcon isUser={true} status={E2EState.Verified} size={128} hideTooltip={true} />
                <div className="mx_VerificationPanel_reciprocateButtons">
                    <AccessibleButton
                        kind="danger"
                        disabled={this.state.reciprocateButtonClicked}
                        onClick={this.onReciprocateNoClick}
                    >
                        { _t("No") }
                    </AccessibleButton>
                    <AccessibleButton
                        kind="primary"
                        disabled={this.state.reciprocateButtonClicked}
                        onClick={this.onReciprocateYesClick}
                    >
                        { _t("Yes") }
                    </AccessibleButton>
                </div>
            </React.Fragment>;
        } else {
            body = <p><Spinner /></p>;
        }
        return <div className="mx_UserInfo_container mx_VerificationPanel_reciprocate_section">
            <h3>{ _t("Verify by scanning") }</h3>
            { body }
        </div>;
    }

    private renderVerifiedPhase() {
        const { member, request } = this.props;

        let text: string;
        if (!request.isSelfVerification) {
            if (this.props.isRoomEncrypted) {
                text = _t("Verify all users in a room to ensure it's secure.");
            } else {
                text = _t("In encrypted rooms, verify all users to ensure it's secure.");
            }
        }

        let description: string;
        if (request.isSelfVerification) {
            const device = this.getDevice();
            if (!device) {
                // This can happen if the device is logged out while we're still showing verification
                // UI for it.
                logger.warn("Verified device we don't know about: " + this.props.request.channel.deviceId);
                description = _t("You've successfully verified your device!");
            } else {
                description = _t("You've successfully verified %(deviceName)s (%(deviceId)s)!", {
                    deviceName: device ? device.getDisplayName() : '',
                    deviceId: this.props.request.channel.deviceId,
                });
            }
        } else {
            description = _t("You've successfully verified %(displayName)s!", {
                displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
            });
        }

        return (
            <div className="mx_UserInfo_container mx_VerificationPanel_verified_section">
                <p>{ description }</p>
                <E2EIcon isUser={true} status={E2EState.Verified} size={128} hideTooltip={true} />
                { text ? <p>{ text }</p> : null }
                <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={this.props.onClose}>
                    { _t("Got it") }
                </AccessibleButton>
            </div>
        );
    }

    private renderCancelledPhase() {
        const { member, request } = this.props;

        let startAgainInstruction: string;
        if (request.isSelfVerification) {
            startAgainInstruction = _t("Start verification again from the notification.");
        } else {
            startAgainInstruction = _t("Start verification again from their profile.");
        }

        let text: string;
        if (request.cancellationCode === "m.timeout") {
            text = _t("Verification timed out.") + ` ${startAgainInstruction}`;
        } else if (request.cancellingUserId === request.otherUserId) {
            if (request.isSelfVerification) {
                text = _t("You cancelled verification on your other device.");
            } else {
                text = _t("%(displayName)s cancelled verification.", {
                    displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
                });
            }
            text = `${text} ${startAgainInstruction}`;
        } else {
            text = _t("You cancelled verification.") + ` ${startAgainInstruction}`;
        }

        return (
            <div className="mx_UserInfo_container">
                <h3>{ _t("Verification cancelled") }</h3>
                <p>{ text }</p>

                <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={this.props.onClose}>
                    { _t("Got it") }
                </AccessibleButton>
            </div>
        );
    }

    public render() {
        const { member, phase, request } = this.props;

        const displayName = (member as User).displayName || (member as RoomMember).name || member.userId;

        switch (phase) {
            case Phase.Ready:
                return this.renderQRPhase();
            case Phase.Started:
                switch (request.chosenMethod) {
                    case verificationMethods.RECIPROCATE_QR_CODE:
                        return this.renderQRReciprocatePhase();
                    case verificationMethods.SAS: {
                        const emojis = this.state.sasEvent ?
                            <VerificationShowSas
                                displayName={displayName}
                                device={this.getDevice()}
                                sas={this.state.sasEvent.sas}
                                onCancel={this.onSasMismatchesClick}
                                onDone={this.onSasMatchesClick}
                                inDialog={this.props.inDialog}
                                isSelf={request.isSelfVerification}
                            /> : <Spinner />;
                        return <div className="mx_UserInfo_container">
                            { emojis }
                        </div>;
                    }
                    default:
                        return null;
                }
            case Phase.Done:
                return this.renderVerifiedPhase();
            case Phase.Cancelled:
                return this.renderCancelledPhase();
        }
        logger.error("VerificationPanel unhandled phase:", phase);
        return null;
    }

    private startSAS = async () => {
        this.setState({ emojiButtonClicked: true });
        const verifier = this.props.request.beginKeyVerification(verificationMethods.SAS);
        try {
            await verifier.verify();
        } catch (err) {
            logger.error(err);
        }
    };

    private onSasMatchesClick = () => {
        this.state.sasEvent.confirm();
    };

    private onSasMismatchesClick = () => {
        this.state.sasEvent.mismatch();
    };

    private updateVerifierState = () => {
        const { request } = this.props;
        const sasEvent = (request.verifier as SAS).sasEvent;
        const reciprocateQREvent = (request.verifier as ReciprocateQRCode).reciprocateQREvent;
        request.verifier.off('show_sas', this.updateVerifierState);
        request.verifier.off('show_reciprocate_qr', this.updateVerifierState);
        this.setState({ sasEvent, reciprocateQREvent });
    };

    private onRequestChange = async () => {
        const { request } = this.props;
        const hadVerifier = this.hasVerifier;
        this.hasVerifier = !!request.verifier;
        if (!hadVerifier && this.hasVerifier) {
            request.verifier.on('show_sas', this.updateVerifierState);
            request.verifier.on('show_reciprocate_qr', this.updateVerifierState);
            try {
                // on the requester side, this is also awaited in startSAS,
                // but that's ok as verify should return the same promise.
                await request.verifier.verify();
            } catch (err) {
                logger.error("error verify", err);
            }
        }
    };

    public componentDidMount() {
        const { request } = this.props;
        request.on("change", this.onRequestChange);
        if (request.verifier) {
            const sasEvent = (request.verifier as SAS).sasEvent;
            const reciprocateQREvent = (request.verifier as ReciprocateQRCode).reciprocateQREvent;
            this.setState({ sasEvent, reciprocateQREvent });
        }
        this.onRequestChange();
    }

    public componentWillUnmount() {
        const { request } = this.props;
        if (request.verifier) {
            request.verifier.off('show_sas', this.updateVerifierState);
            request.verifier.off('show_reciprocate_qr', this.updateVerifierState);
        }
        request.off("change", this.onRequestChange);
    }
}
