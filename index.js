import React, { Component } from 'react';
import {
    StyleSheet,
    View,
    Text,
    PanResponder,
    Animated,
    Dimensions,
    LayoutAnimation,
    FlatList,
    TouchableHighlight
} from 'react-native';

import PropTypes from 'prop-types';

const HEIGHT = Dimensions.get('window').height

let DATA = [
    "James",
    "Michael",
    "Harrold",
    "Chloe",
    "Bob",
    "George",
    "Samantha",
    "Jenny",
    "Sharon"
];

class Row extends Component {

    static propTypes = {
        list: PropTypes.object.isRequired,
        active: PropTypes.bool.isRequired,
        rowData: PropTypes.object.isRequired,
        onRowLayout: PropTypes.func.isRequired,
        onRowActive: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);

        this._data = {};
        this.handleLongPress = this.handleLongPress.bind(this);
    }

    shouldComponentUpdate(props) {
        // return true;
        if (props.hovering !== this.props.hovering) return true
        if (props.active !== this.props.active) return true
        if (props.rowData.item !== this.props.rowData.item) return true
        if (props.rowHasChanged) {
            console.log("row has changed")
            return props.rowHasChanged(props.rowData.item, this._data)
        }
        return false;
    }

    componentDidUpdate(props) {
        // Take a shallow copy of the active data. So we can do manual comparisons of rows if needed.
        if (props.rowHasChanged) {
            this._data = typeof props.rowData.data === 'object'
            ? Object.assign({}, props.rowData.data)
            : props.rowData.data
        }
    }

    render() {
        const activeData = this.props.list.state.active;
        const activeIndex = activeData ? activeData.rowData.index : -5;
        const shouldDisplayHovering = activeIndex !== this.props.rowData.index;
        // console.log("this.props.hovering", this.props.hovering, typeof this.props.hovering);
        // console.log("shouldDisplayHovering", shouldDisplayHovering);
        // console.log("activeIndex", activeIndex, typeof activeIndex);
        // console.log("this.props.rowData.index",this.props.rowData.index)

        const Row = React.cloneElement(
            this.props.renderItem( this.props.rowData, this.props.active),
            {
                sortHandlers: {
                    onLongPress: this.handleLongPress,
                    onPressOut: this.props.list.cancel
                },
                onLongPress: this.handleLongPress,
                onPressOut: this.props.list.cancel
            }
        );

        // console.log("this.props.hovering", this.props.hovering)
        // console.log("this.props.hovering && shouldDisplayHovering",this.props.hovering && shouldDisplayHovering)
        // console.log("activeData", activeData);
        return (
            <View
                onLayout={this.props.onRowLayout}
                ref="view"
                style={
                    [
                        this.props.active && !this.props.hovering ? { height: 0.01 } : null, 
                        this.props.active && this.props.hovering ? { opacity: 0.0 } : null,
                    ]
                }
            >
                { this.props.hovering && shouldDisplayHovering ? this.props.activeDivider : null }
                {Row}
            </View>
        )
    }

    handleLongPress(e) {
        // console.log("handleLongPress...");
        this.refs.view.measure(
            (frameX, frameY, frameWidth, frameHeight, pageX, pageY) => {
                const layout = { frameHeight, pageY };
                this.props.onRowActive({
                    layout,
                    touch: e.nativeEvent,
                    rowData: this.props.rowData
                });
            }
        );
    }

    measure(...args) {
        this.refs.view.measure(...args);
    }

}

class SortRow extends Component {

    static propTypes = {
        list: PropTypes.any.isRequired,
        rowData: PropTypes.object.isRequired,
        active: PropTypes.any.isRequired
    }

    constructor(props) {
        super(props);

        const layout = props.list.state.active.layout;
        const wrapperLayout = props.list.wrapperLayout;

        this.state = {
            style: {
                position: 'absolute',
                left: 0,
                right: 0,
                opacity: props.activeOpacity || 0.2,
                height: layout.frameHeight,
                overflow: 'hidden',
                backgroundColor: 'transparent',
                marginTop: layout.pageY - wrapperLayout.pageY, // Account for top bar spacing
            }
        }
    }

    render() {
        return (
            <Animated.View
                style={[
                    this.state.style,
                    this.props.list.state.pan.getLayout()
                ]}
                ref="view"
            >
                {
                    this.props.renderItem( this.props.rowData, true )
                }
            </Animated.View>
        )
    }

}

class FlatListSortable extends Component {

    static propTypes = {
        data: PropTypes.array.isRequired,
        renderItem: PropTypes.func.isRequired
    }

    constructor(props) {
        super(props);

        const currentPanValue = { x: 0, y: 0 }
    
        this.state = {
            pan: new Animated.ValueXY(currentPanValue),
            active: false,
            hovering: false,
        }

        this.listener = this.state.pan.addListener(e => (this.panY = e.y));

        this.handleRowActive = this.handleRowActive.bind(this);
        this.renderItem = this.renderItem.bind(this);
        this.handleWrapperLayout = this.handleWrapperLayout.bind(this);
        this.cancel = this.cancel.bind(this);

        const onPanResponderMoveCb = Animated.event([
          null,
          {
            dx: this.state.pan.x, // x,y are Animated.Value
            dy: this.state.pan.y,
          },
        ])
    
        this.moved = false
        this.moveY = null
        this.dy = 0
        this.direction = 'down'
    
        this.state.panResponder = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponderCapture: (e, gestureState) => {
                // Only capture when moving vertically, this helps for child swiper rows.
                const vy = Math.abs(gestureState.vy)
                const vx = Math.abs(gestureState.vx)
        
                return vy > vx && this.state.active
            },
            onPanResponderMove: (e, gestureState) => {
                if (!this.state.active) return;
                gestureState.dx = 0;
                const layout = this.state.active.layout;
                this.moveY = layout.pageY + layout.frameHeight / 2 + gestureState.dy;
                this.direction = gestureState.dy >= this.dy ? 'down' : 'up';
                this.dy = gestureState.dy;
                onPanResponderMoveCb(e, gestureState);
                // console.log("this.state.hovering", this.state.hovering);
            },
        
            onPanResponderGrant: (e) => {
                // console.log("e.nativeEvent", e.nativeEvent);
                if (!this.state.active) return
                this.moved = true
                this.dy = 0
                this.direction = 'down'
                props.onMoveStart && props.onMoveStart()
                this.state.pan.setOffset(currentPanValue)
                this.state.pan.setValue(currentPanValue)
            },
            onPanResponderRelease: (e) => {
                // console.log("onPanResponderRelease");
                // console.log("!this.state.active",!this.state.active)
                if (!this.state.active) return;
                this.moved = false;
                props.onMoveEnd && props.onMoveEnd();
                if (!this.state.active) {
                    if (this.state.hovering) {
                        this.setState({ hovering: false });
                    }
                    this.moveY = null;
                    return;
                }
                const itemHeight = this.state.active.layout.frameHeight;
                // console.log("this.state.active.rowData.index",this.state.active.rowData.index)
                // console.log("this.order", this.order);
                const fromIndex = this.order.map(item => parseInt(item)).indexOf(this.state.active.rowData.index);
                // console.log("fromIndex", fromIndex);
                // console.log("this.state.hovering", this.state.hovering);
                let toIndex = this.state.hovering === false ? fromIndex : Number(this.state.hovering);
                // console.log("toIndex", toIndex);
                const up = toIndex > fromIndex
                if (up) {
                    toIndex--;
                }
                if (toIndex === fromIndex) {
                    return this.setState({ active: false, hovering: false });
                }
                const args = {
                    row: this.state.active.rowData,
                    from: fromIndex,
                    to: toIndex,
                }
        
                props.onRowMoved && props.onRowMoved(args);
                if (props._legacySupport) {
                    // rely on parent data changes to set state changes
                    // LayoutAnimation.easeInEaseOut()
                    this.state.active = false;
                    this.state.hovering = false;
                } else {
                    this.setState({
                        active: false,
                        hovering: false,
                    });
                }
        
                const MAX_HEIGHT = Math.max(
                    0,
                    this.scrollContainerHeight - this.listLayout.height + itemHeight
                );

                // console.log("this.scrollValue > MAX_HEIGHT",this.scrollValue > MAX_HEIGHT)
                
                if (this.scrollValue > MAX_HEIGHT) {
                    this.scrollTo({ y: MAX_HEIGHT });
                }
        
                this.state.active = false
                this.state.hovering = false
                this.moveY = null
            },
        });

        this.scrollValue = 0
        // Gets calculated on scroll, but if you havent scrolled needs an initial value
        this.scrollContainerHeight = HEIGHT * 1.2
    
        this.firstRowY = undefined;
        this.layoutMap = {}
        this._rowRefs = {}
    }

    _keyExtractor = (item, index) => index.toString();   
    
    shouldComponentUpdate(props) {
        return true;
    }

    componentWillMount() {
        this.setOrder(this.props)
    }

    componentWillReceiveProps(props) {
        this.setOrder(props)
    }

    componentWillUnmount() {
        this.state.pan.removeListener(this.listener)
    }

    setOrder = props => {
        this.order = props.order || Object.keys(props.data) || [];
    }

    render() {
        return (
            <View style={styles.mainContainer} onLayout={this.handleWrapperLayout}>
                <FlatList
                    {...this.props}
                    {...this.state.panResponder.panHandlers}
                    ref="list"
                    onScroll={this.handleScroll}
                    onContentSizeChange={this.handleContentSizeChange}
                    onLayout={this.handleListLayout}
                    keyExtractor={this._keyExtractor}
                    data={this.props.data}
                    renderItem={this.renderItem}
                    scrollEnabled={!this.state.active}
                />
                {this.renderActive()}
            </View>
        );
    }

    renderActiveDivider = () => {
        const height = this.state.active
          ? this.state.active.layout.frameHeight
          : null
        if (this.props.renderActiveDivider) {
          return this.props.renderActiveDivider(height)
        }

        // console.log("height", height);
        return <View style={{ height }} />
      }

    renderItem(data, active) {
        const Component = active ? SortRow : Row;
        const isActiveRow = !active && this.state.active && this.state.active.rowData.index === data.index;
        const hoveringIndex = this.order[this.state.hovering] || this.state.hovering;

        // console.log("hoveringIndex", hoveringIndex);
        // console.log("data.index", data.index);
        // console.log("hoveringIndex === data.index", hoveringIndex === data.index);

        return (
            <Component
                {...this.props}
                activeDivider={this.renderActiveDivider()}
                active={active || isActiveRow}
                hovering={Number(hoveringIndex) === data.index}
                list={this}
                rowData={data}
                ref={
                    view => {
                        this._rowRefs[active ? 'ghost' : data.index] = view
                    }
                }
                panResponder={this.state.panResponder}
                onRowActive={this.handleRowActive}
                onRowLayout={this._updateLayoutMap(data.index)}
            />
        )
    }

    handleWrapperLayout(e) {
        const layout = e.nativeEvent.layout
        this.wrapperLayout = {
            frameHeight: layout.height,
            pageY: layout.y,
        }
    }

    cancel() {
        if (!this.moved) {
            this.state.active && this.props.onMoveCancel && this.props.onMoveCancel()
            this.setState({
                active: false,
                hovering: false,
            });
        }
    }

    renderActive() {        
        if (!this.state.active) return
        const index = this.state.active.rowData.index;
        return this.renderItem(
            { item: this.props.data[index], index: index },
            true
        );
    }

    _updateLayoutMap = index => e => {
        const layout = e.nativeEvent.layout
        if (this.firstRowY === undefined || layout.y < this.firstRowY) {
            this.firstRowY = layout.y
        }
        this.layoutMap[index] = layout
    }

    handleListLayout = e => {
        console.log("handleListLayout")
        this.listLayout = e.nativeEvent.layout;
    }

    handleScroll = e => {
        // console.log("handleScroll", e.nativeEvent.contentOffset.y);
        this.scrollValue = e.nativeEvent.contentOffset.y;
        if (this.props.onScroll) {
            this.props.onScroll(e);
        }
    }

    handleContentSizeChange = (width, height) => {
        // console.log("handleContentSizeChange")
        this.scrollContainerHeight = height;
    }

    scrollAnimation = () => {
        // console.log("scrollAnimation");
        // console.log("this.state.hovering", this.state.hovering);
        if (this.state.active) {
            if (this.moveY === undefined) {
                return requestAnimationFrame(this.scrollAnimation)
            }

            const SCROLL_OFFSET = this.wrapperLayout.pageY;
            const moveY = this.moveY - SCROLL_OFFSET;
            const SCROLL_LOWER_BOUND = 80;
            const SCROLL_HIGHER_BOUND = this.listLayout.height - SCROLL_LOWER_BOUND;
            const NORMAL_SCROLL_MAX = this.scrollContainerHeight - this.listLayout.height;
            const MAX_SCROLL_VALUE = NORMAL_SCROLL_MAX + this.state.active.layout.frameHeight * 2;
            const currentScrollValue = this.scrollValue;
            let newScrollValue = null;
            const SCROLL_MAX_CHANGE = 20;

            // console.log("moveY < SCROLL_LOWER_BOUND && currentScrollValue > 0", moveY < SCROLL_LOWER_BOUND && currentScrollValue > 0);

            if (moveY < SCROLL_LOWER_BOUND && currentScrollValue > 0) {
                const PERCENTAGE_CHANGE = 1 - moveY / SCROLL_LOWER_BOUND
                newScrollValue = currentScrollValue - PERCENTAGE_CHANGE * SCROLL_MAX_CHANGE
                if (newScrollValue < 0) {
                    newScrollValue = 0
                }
            }
            if ( moveY > SCROLL_HIGHER_BOUND && currentScrollValue < MAX_SCROLL_VALUE ) {
                const PERCENTAGE_CHANGE = 1 - (this.listLayout.height - moveY) / SCROLL_LOWER_BOUND;
                newScrollValue = currentScrollValue + PERCENTAGE_CHANGE * SCROLL_MAX_CHANGE;
                
                if (newScrollValue > MAX_SCROLL_VALUE) {
                    newScrollValue = MAX_SCROLL_VALUE;
                }
            }
            // console.log("newScrollValue !== null && !this.props.limitScrolling", newScrollValue !== null && !this.props.limitScrolling);
            if (newScrollValue !== null && !this.props.limitScrolling) {
                this.scrollValue = newScrollValue*1.25;
                this.scrollTo({ y: this.scrollValue });
            }
            this.moved && this.checkTargetElement();
            requestAnimationFrame(this.scrollAnimation); 
        }
    }

    checkTargetElement = () => {
        const itemHeight = this.state.active.layout.frameHeight;
        const SLOP = this.direction === 'down' ? itemHeight : 0;
        const scrollValue = this.scrollValue;
        const moveY = this.moveY - this.wrapperLayout.pageY;
        const activeRowY = scrollValue + moveY - this.firstRowY;

        let indexHeight = 0.0;
        let i = 0;
        let row;

        const order = this.order;

        let isLast = false;

        while (indexHeight < activeRowY + SLOP) {
            const key = order[i];
            row = this.layoutMap[key];
            if (!row) {
                isLast = true;
                break;
            }
            indexHeight += row.height;
            i++;
        }
        if (!isLast) {
            i--;
        }

        if (i !== this.state.hovering && i >= 0) {
            console.log("hellllloooooo")
            LayoutAnimation.easeInEaseOut();
            this._previouslyHovering = this.state.hovering;
            this.__activeY = this.panY;
            this.setState({
                hovering: i,
            });
        }
    }

    handleRowActive(row) {
        // console.log("handleRowActive");
        if (this.props.disableSorting) return;
        this.state.pan.setValue({ x: 0, y: 0 });
        LayoutAnimation.easeInEaseOut();
        this.moveY = row.layout.pageY + row.layout.frameHeight / 2
        // console.log("row.rowData.index", row.rowData.index, typeof row.rowData.index)
        this.setState(
            {
                active: row,
                hovering: row.rowData.index,
            },
            this.scrollAnimation
        );
        this.props.onRowActive && this.props.onRowActive(row)
    }

    scrollTo = (...args) => {
        // console.log("...args", ...args);
        this.refs.list.scrollTo(...args)
    }

}

export default class Viewport extends React.Component{

    render() {
        // console.log("Viewport");
        return (
            <FlatListSortable
                onRowMoved={e => {
                    DATA.splice(e.to, 0, DATA.splice(e.from, 1)[0]);
                    this.forceUpdate();
                }}
                data={DATA}
                renderItem={({item, index}) => <TouchableHighlight underlayColor={'transparent'} style={{padding: 16, borderWidth: 1}}><Text>{item}</Text></TouchableHighlight>}
            />
        )
    }
    
}

const styles = StyleSheet.create({
    mainContainer: {
        flex        : 1,
        paddingTop  : 22
    }
});