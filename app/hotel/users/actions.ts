"use server";

export {
  createStaffUserAction,
  createDepartmentAction,
  type CreateStaffResult,
  type CreateDepartmentResult,
} from "@/lib/actions/hr-staff";

export {
  updateDepartmentAction,
  setDepartmentActiveAction,
  deleteDepartmentAction,
  updateHotelStaffUserAction,
  activateHotelStaffUserAction,
  deactivateHotelStaffUserAction,
  deleteHotelStaffUserAction,
} from "@/lib/actions/hotel-users";
