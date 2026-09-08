import type { FriendLink, FriendsPageConfig } from "../types/friendsConfig";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "小猫的朋友们",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "这里是小猫的朋友的链接哦!",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,
};

// 友链配置
export const friendsConfig: FriendLink[] = [
	{
		title: "Ksayus",
		imgurl:
			"https://i1.hdslb.com/bfs/face/4caa131b56ca920cfbf7ac22968c9dbdd8486b3b.jpg",
		desc: "细碎的美好也是生活的意义。",
		siteurl: "https://space.bilibili.com/558271819",
		tags: ["Bilibili", "Myself"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "凛冬山雀",
		imgurl: "https://i1.hdslb.com/bfs/face/5701af6c9123bef1f520a73025c8e357966d4a71.jpg",
		desc: "细碎的美好也是生活的意义。",
		siteurl: "https://space.bilibili.com/506610659",
		tags: ["Bilibili", "Friendship"],
		weight: 9,
		enabled: true,
	},
	{
		title: "Ksayus code space",
		imgurl: "https://i1.hdslb.com/bfs/face/4caa131b56ca920cfbf7ac22968c9dbdd8486b3b.jpg",
		desc: "The web framework for content-driven websites. ⭐️ Star to support our work!",
		siteurl: "https://github.com/ksayus",
		tags: ["GitHub"],
		weight: 8,
		enabled: true,
	},
];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
