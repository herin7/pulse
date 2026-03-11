import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
    name: 'chat',
    initialState: {
        messages: [],
        isLoading: false,
        activeModel: 'gemini',
        overdueLoops: [],
        showLoopBanner: false,
        toast: null,
        competitorStatus: null,
        lastRefreshed: null,
        refreshing: false,
        showPanel: false,
    },
    reducers: {
        addMessage(state, action) {
            state.messages.push(action.payload);
        },
        setLoading(state, action) {
            state.isLoading = action.payload;
        },
        setActiveModel(state, action) {
            state.activeModel = action.payload;
        },
        setCompetitorStatus(state, action) {
            state.competitorStatus = action.payload;
        },
        setRefreshing(state, action) {
            state.refreshing = action.payload;
        },
        setLastRefreshed(state, action) {
            state.lastRefreshed = action.payload;
        },
        setShowPanel(state, action) {
            state.showPanel = action.payload;
        },
        setOverdueLoops(state, action) {
            state.overdueLoops = action.payload;
        },
        setShowLoopBanner(state, action) {
            state.showLoopBanner = action.payload;
        },
        setToast(state, action) {
            state.toast = action.payload;
        },
        clearMessages(state) {
            state.messages = [];
        },
    },
});

export const {
    addMessage,
    setLoading,
    setActiveModel,
    setCompetitorStatus,
    setRefreshing,
    setLastRefreshed,
    setShowPanel,
    setOverdueLoops,
    setShowLoopBanner,
    setToast,
    clearMessages,
} = chatSlice.actions;

export default chatSlice.reducer;
