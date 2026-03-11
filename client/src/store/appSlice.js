import { createSlice } from '@reduxjs/toolkit';

const appSlice = createSlice({
    name: 'app',
    initialState: {
        screen: 'onboarding',
        formData: null,
        characterCard: null,
        sessionChecked: false,
        user: null,
        token: null,
        authModalOpen: false,
    },
    reducers: {
        setScreen(state, action) {
            state.screen = action.payload;
        },
        setFormData(state, action) {
            state.formData = action.payload;
        },
        setCharacterCard(state, action) {
            state.characterCard = action.payload;
        },
        sessionLoaded(state, action) {
            state.sessionChecked = true;
            if (action.payload.exists) {
                state.characterCard = action.payload.characterCard;
                state.screen = 'chat';
            }
        },
        resetSession(state) {
            state.screen = 'onboarding';
            state.formData = null;
            state.characterCard = null;
            state.sessionChecked = false;
            state.user = null;
            state.token = null;
        },
        setAuth(state, action) {
            state.user = action.payload.user;
            state.token = action.payload.token;
        },
        setAuthModal(state, action) {
            state.authModalOpen = action.payload;
        },
    },
});

export const {
    setScreen,
    setFormData,
    setCharacterCard,
    sessionLoaded,
    resetSession,
    setAuth,
    setAuthModal,
} = appSlice.actions;

export default appSlice.reducer;
