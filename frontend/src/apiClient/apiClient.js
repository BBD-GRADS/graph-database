import axios from "axios";

const BASE_URL =
	"http://graphdatabaselb-1553808233.eu-west-1.elb.amazonaws.com";

export const getAllDeliveryPoints = async () => {
	try {
		const response = await axios.get(`${BASE_URL}/delivery/points`);
		return response.data;
	} catch (error) {
		console.error("Error fetching delivery points:", error);
		throw error;
	}
};

export const addDeliveryPoint = async (pointData) => {
	try {
		const response = await axios.post(`${BASE_URL}/delivery/point`, pointData);
		return response.data;
	} catch (error) {
		console.error("Error adding delivery point:", error);
		throw error;
	}
};

export const deleteDeliveryPoint = async (deliveryPointID) => {
	try {
		const response = await axios.delete(`${BASE_URL}/delivery/point`, {
			data: { DeliveryPointID: deliveryPointID },
		});
		return response.data;
	} catch (error) {
		console.error("Error deleting delivery point:", error);
		throw error;
	}
};

export const deleteAllDeliveryPoints = async () => {
	try {
		const response = await axios.delete(`${BASE_URL}/delivery/all-points`);
		return response.data;
	} catch (error) {
		console.error("Error deleting all delivery points:", error);
		throw error;
	}
};
