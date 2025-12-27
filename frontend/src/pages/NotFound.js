import React from 'react';
import { Link } from 'react-router-dom';
import { FaExclamationTriangle, FaHome } from 'react-icons/fa';

const NotFound = () => {
    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-full mb-6 animate-bounce">
                <FaExclamationTriangle className="text-6xl text-orange-500" />
            </div>

            <h1 className="text-6xl font-black text-slate-900 dark:text-white mb-2">404</h1>
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4">Page Not Found</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>

            <Link
                to="/"
                className="btn bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-blue-500/30 transition-all"
            >
                <FaHome /> Back to Home
            </Link>
        </div>
    );
};

export default NotFound;
