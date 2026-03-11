import { configureStore } from '@reduxjs/toolkit';
import appReducer from './appSlice';
import chatReducer from './chatSlice';

const store = configureStore({
    reducer: {
        app: appReducer,
        chat: chatReducer,
    },
    // RTK already includes redux-thunk by default
    devTools: import.meta.env.DEV,
});

export default store;
