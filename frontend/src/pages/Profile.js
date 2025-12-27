import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FaUserCircle, FaEnvelope, FaIdBadge, FaBuilding } from 'react-icons/fa';

const Profile = () => {
    const { currentUser } = useAuth();

    if (!currentUser) {
        return <div className="p-8 text-center">Loading Profile...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">

                {/* Header Background */}
                <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-800 dark:to-indigo-800 relative">
                    <div className="absolute inset-0 bg-pattern opacity-10"></div>
                </div>

                <div className="px-8 pb-8">
                    <div className="relative flex justify-between items-end -mt-12 mb-6">
                        <div className="relative">
                            <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full p-1 shadow-lg">
                                <div className="w-full h-full bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-4xl text-slate-400 dark:text-slate-500">
                                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : <FaUserCircle />}
                                </div>
                            </div>
                            <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-white dark:border-slate-800 rounded-full transform translate-x-1 translate-y-1"></div>
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                        {currentUser.name}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
                        {currentUser.role || 'Member'}
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Personal Info Card */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <FaIdBadge className="text-blue-500" /> Account Details
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</span>
                                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                                        <FaEnvelope className="text-slate-400" /> {currentUser.email}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Role</span>
                                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                                        <FaBuilding className="text-slate-400" /> {currentUser.role || 'Standard User'}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">User ID</span>
                                    <code className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                                        {currentUser.id || currentUser._id}
                                    </code>
                                </div>
                            </div>
                        </div>

                        {/* Stats or Additional Info */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 flex flex-col justify-center items-center text-center">
                            <div className="mb-4">
                                <span className="text-5xl font-black text-slate-200 dark:text-slate-700">v2.0</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400">
                                You are using the latest version of the Logistics Platform.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Profile;
