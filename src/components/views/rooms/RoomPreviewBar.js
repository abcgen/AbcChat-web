/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

var React = require('react');

module.exports = React.createClass({
    displayName: 'RoomPreviewBar',

    propTypes: {
        onJoinClick: React.PropTypes.func,
        canJoin: React.PropTypes.bool
    },

    getDefaultProps: function() {
        return {
            onJoinClick: function() {},
            canJoin: false
        };
    },

    render: function() {
        var joinBlock;

        if (this.props.canJoin) {
            joinBlock = (
                <div className="mx_RoomPreviewBar_join_text">
                Would you like to <a onClick={this.props.onJoinClick}>join</a> this room?
                </div>
            );
        }

        return (
            <div className="mx_RoomPreviewBar">
                <div className="mx_RoomPreviewBar_preview_text">
                This is a preview of this room. Room interactions have been disabled.
                </div>
                {joinBlock}
            </div>
        );
    }
});
