// 来自desktop-app
// 待修改

var db = require('../DB/Sqlite');

var Evt = require('./evt');

var fs = {}; // require('fs');

function log(o) {
	console.log(o);
}

/**
UserId (主键)
Email
Username
Token
LastLoginTime
IsActive // 是否是活跃用户
*/
// var User = {}

var Api = null; // require('api');
// 用户基本信息
User = {
	token: '',
	userId: '',
	email: '',
	username: '',
	host: '', // 服务
	LastSyncUsn: -1,
	LastSyncTime: null,
	// 登录后保存当前
	setCurUser: function(user) {
		var me = this;
		if(user) {
			this.token = user.Token;
			this.userId = user.UserId;
			this.email = user.Email;
			this.username = user.Username;
			this.host = user.Host; // http://leanote.com, http://localhost
			// 保存到数据库中
			this.saveCurUser(user);

			// 判断当前用户是否有文件夹
			me.setUserDataPath();
		}
	},
	// 不同host的userId可能一样, 潜在的bug
	saveCurUser: function(user, callback) {
		// 当前用户是否在数据库中
		console.log('save cur User');
		db.users.count({_id: user.UserId}, function(err, count) {
			if(!count) {
				console.log('当前用户不在数据库中, 添加一个');
				// 添加一个
				user['_id'] = user.UserId;
				user['IsActive'] = true;
				db.users.insert(user, function(err, doc) {
					console.log(err);
				});
			} else {
				user.IsActive = true;
				delete user['Ok'];
				console.log('当前用户在数据库中, 更新下');
				db.users.update({_id: user.UserId}, user, function(err, cnt) {
					if(err || cnt == 0) {
						console.log(err);
						callback && callback(false);
					} else {
						callback && callback(true);
					}
				});
			}
		});
		// console.log(".........");
		// console.log(user);
		// 设值其它用户为非active
		db.users.update({_id: {$ne: user.UserId}}, {IsActive: false}, {multi: true}, function(err, n) { 
			// console.log(err);
			// console.log(n);
		});
	},

	// for test
	getAllUsers: function(callback) {
		var me = this;
		db.users.find({}, function(err, users) {
			callback && callback(users);
		});
	},

	// 打开软件时, 从db中获取当前用户
	init: function(callback) {
		console.log("......user init.......")
		var me = this;

		me.getG(function(g) {
			me.g = g;

			db.users.findOne({IsActive: true}, function(err, user) {
				if(err || !user || !user.UserId) {
					console.log('用户不存在');
					callback && callback(false);
				} else {
					// me.setCurUser(doc);
					me.token = user.Token;
					me.userId = user.UserId;
					me.email = user.Email;
					me.username = user.Username;
					me.LastSyncUsn = user.LastSyncUsn;
					me.LastSyncTime = user.LastSyncTime;
					me.host = user.Host;

					Evt.setHost(me.host);

					// 全局配置也在user中, 到web端
					for(var i in me.g) {
						user[i] = me.g[i];
					}

					// 设置当前用户数据路径
					me.setUserDataPath();

					callback && callback(user);
				}
			});

		});
	},
	// 得到当前活跃用户Id
	getCurActiveUserId: function() {
		return this.userId || "user1";
	},
	getToken: function() {
		return this.token || "user1";
	},
	getCurUserImagesPath: function() {
		return Evt.getBasePath() + '/' + this.getCurUserImagesAppPath();
	},
	getCurUserAttachsPath: function() {
		return Evt.getBasePath() + '/' + this.getCurUserAttachsAppPath();
	},
	getCurUserImagesAppPath: function() {
		return 'data/' + this.getCurActiveUserId() + '/images';
	},
	getCurUserAttachsAppPath: function() {
		return 'data/' + this.getCurActiveUserId() + '/attachs';
	},

	setUserDataPath: function(userId) {
		var me = this;
		return;
		// 判断是否存在, 不存在则创建dir
		try {
			fs.mkdirSync(Evt.getBasePath() + '/data/');
		}
		catch(e) {};
		try {
			fs.mkdirSync(Evt.getBasePath() + '/data/' + this.getCurActiveUserId());
		} catch(e) {
		}
		try {
			fs.mkdirSync(Evt.getBasePath() + '/data/' + this.getCurActiveUserId() + '/images');
		} catch(e) {
		}
		try {
			fs.mkdirSync(Evt.getBasePath() + '/data/' + this.getCurActiveUserId() + '/attachs');
		} catch(e) {
		}
	},

	getCurUser: function(callback) {
		var me = this;
		db.users.findOne({_id: me.getCurActiveUserId()}, function(err, doc) {
			if(err) {
				callback(false);
			} else {
				callback(doc);
			}
		});
	},

	getLastSyncState: function(callback) {
		var me = this;
		me.getCurUser(function(user) {
			if(user) {
				callback(user.LastSyncUsn, user.LastSyncTime);
			} else {
				callback(false, false);
			}
		})
	},

	// 设为-1, 再刷新就会重新同步
	fullSyncForce: function(callback) {
		var me = this;
		db.users.update({UserId: me.getCurActiveUserId()}, {LastSyncUsn: -1}, function() {
			callback && callback();
		});
	},

	// 同步后更新同步状态
	updateLastSyncState: function(callback) {
		var me = this;
		if(!Api) {
			Api = require('./api');
		}
		Api.getLastSyncState(function(state) {
			if(state) {
				console.error('--updateLastSyncState---')
				console.log(state);
				me.LastSyncUsn = state.LastSyncUsn;
				me.LastSyncTime = state.LastSyncTime;
				db.users.update({UserId: me.getCurActiveUserId()}, state);
			}
			callback();
		});
	},

	// send changes要用
	getLastSyncUsn: function() {
		var me = this;
		return me.LastSyncUsn;
	},
	// 更新 send changes要用
	updateLastSyncUsn: function(usn) {
		var me = this;
		me.LastSyncUsn = usn;
		db.users.update({UserId: me.getCurActiveUserId()}, {LastSyncUsn: usn});
	},

	// 全局配置
	getG: function(callback) {
		var me = this;
		db.g.findOne({_id: '1'}, function(err, doc) {
			if(err || !doc) {
				callback({});
			} else {
				callback(doc);
			}
		});
	},
	// data = {Theme, NotebookWidth, NoteListWidth, MdEditorWidth, Version};
	updateG: function(data, callback) {
		db.g.update({_id: '1'}, data, {upsert: true}, function() {
			callback && callback();
		});
	},
	/**
	 * [saveCurState description]
	 * @param  {[type]} state [description]
	 * @return {[type]}       [description]
	 User.saveCurState({
			StarredOpened: StarredOpened, 
			NotebookOpened: NotebookOpened,
			TagOpened: TagOpened,
			CurNoteId: CurNoteId,
			CurIsStarred: CurIsStarred,
			CurNotebookId: CurNotebookId,
			CurTag: CurTag
		}, callback);
	 */
	saveCurState: function(state, callback) {
		var me = this;
		state = state || {};
		db.users.update({_id: me.getCurActiveUserId()}, {State: state}, function() {
			callback && callback();
		});
	}
};

module.exports = User;
