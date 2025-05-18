import { ActivityLog } from "@shared/schema";
import { activityTypeIcon, formatTimeAgo } from "@/lib/utils";

type ActivityItemProps = {
  activity: ActivityLog;
};

export default function ActivityItem({ activity }: ActivityItemProps) {
  const { icon, bgColor, iconColor } = activityTypeIcon(activity.type);
  
  return (
    <div className="flex items-center py-2 border-b border-neutral-200">
      <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center mr-3`}>
        <i className={`${icon} ${iconColor}`}></i>
      </div>
      <div>
        <p className="text-sm">{activity.description}</p>
        <p className="text-xs text-neutral-500">{formatTimeAgo(activity.timestamp)}</p>
      </div>
    </div>
  );
}
