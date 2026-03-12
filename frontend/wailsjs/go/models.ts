export namespace app {
	
	export class AuthUser {
	    id: number;
	    username: string;
	    email: string;
	    avatar_url: string;
	    provider: string;
	    is_verified: number;
	
	    static createFrom(source: any = {}) {
	        return new AuthUser(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.username = source["username"];
	        this.email = source["email"];
	        this.avatar_url = source["avatar_url"];
	        this.provider = source["provider"];
	        this.is_verified = source["is_verified"];
	    }
	}
	export class Reply {
	    id: number;
	    review_id: number;
	    author: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new Reply(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.review_id = source["review_id"];
	        this.author = source["author"];
	        this.content = source["content"];
	    }
	}
	export class Review {
	    id: number;
	    pkg_name: string;
	    username: string;
	    rating: number;
	    comment: string;
	    created_at: string;
	    likes: number;
	    dislikes: number;
	    replies: Reply[];
	
	    static createFrom(source: any = {}) {
	        return new Review(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.pkg_name = source["pkg_name"];
	        this.username = source["username"];
	        this.rating = source["rating"];
	        this.comment = source["comment"];
	        this.created_at = source["created_at"];
	        this.likes = source["likes"];
	        this.dislikes = source["dislikes"];
	        this.replies = this.convertValues(source["replies"], Reply);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RatingDist {
	    stars: number;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new RatingDist(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stars = source["stars"];
	        this.count = source["count"];
	    }
	}
	export class PackageRating {
	    pkg_name: string;
	    average: number;
	    total_votes: number;
	    distribution: RatingDist[];
	    reviews: Review[];
	
	    static createFrom(source: any = {}) {
	        return new PackageRating(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pkg_name = source["pkg_name"];
	        this.average = source["average"];
	        this.total_votes = source["total_votes"];
	        this.distribution = this.convertValues(source["distribution"], RatingDist);
	        this.reviews = this.convertValues(source["reviews"], Review);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PkgInfo {
	    name: string;
	    version: string;
	    description: string;
	    source: string;
	    installed: boolean;
	    size_kb: number;
	    maintainer: string;
	    url: string;
	    depends: string[];
	    votes: number;
	    popularity: number;
	    last_updated: string;
	    rating?: PackageRating;
	
	    static createFrom(source: any = {}) {
	        return new PkgInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.description = source["description"];
	        this.source = source["source"];
	        this.installed = source["installed"];
	        this.size_kb = source["size_kb"];
	        this.maintainer = source["maintainer"];
	        this.url = source["url"];
	        this.depends = source["depends"];
	        this.votes = source["votes"];
	        this.popularity = source["popularity"];
	        this.last_updated = source["last_updated"];
	        this.rating = this.convertValues(source["rating"], PackageRating);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class SystemInfo {
	    kernel_version: string;
	    arch_version: string;
	    cpu: string;
	    ram: string;
	    has_yay: boolean;
	    has_paru: boolean;
	    aur_helper: string;
	    has_timeshift: boolean;
	    has_snapper: boolean;
	    snapshot_tool: string;
	
	    static createFrom(source: any = {}) {
	        return new SystemInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kernel_version = source["kernel_version"];
	        this.arch_version = source["arch_version"];
	        this.cpu = source["cpu"];
	        this.ram = source["ram"];
	        this.has_yay = source["has_yay"];
	        this.has_paru = source["has_paru"];
	        this.aur_helper = source["aur_helper"];
	        this.has_timeshift = source["has_timeshift"];
	        this.has_snapper = source["has_snapper"];
	        this.snapshot_tool = source["snapshot_tool"];
	    }
	}

}

